const express = require("express");
const multer = require("multer");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const xlsx = require("xlsx");
const router = express.Router();
const app = express();
var cors = require("cors");
const { response, request } = require("express");
var async = require("async");
var moment = require("moment");
var date = require("date-and-time");

//npx kill-port 3000
const port = 3000;

const {
  getAuthToken,
  appendData,
  clearData,
} = require("./googleSheetsService.js");

const {
  getAuthTokenTa,
  appendDataTa,
  clearDataTa,
} = require("./googleSheetsService_taallocation.js");

// Multer middleware for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());

app.use("/misapi", router);

router.use((request, res, next) => {
  console.log("middleware");
  next();
});

const pool = mysql.createPool({
  connectionLimit: 10,
  // host: "localhost",
  host: "localhost", //localhost 10.1.19.34
  user: "root",
  password: "",
  database: "csis", //csis
  // dateStrings: true,
});

// app.get("/", (req, res) => {
//   res.send("Hello World!");
// });

router.route("/").get((req, res) => {
  res.send("Hello World!");
});

router.route("/getcourse").get((request, res) => {
  pool.getConnection((err, connection) => {
    if (err) throw err;
    connection.query("SELECT * from course", (err, rows) => {
      connection.release(); // return the connection to pool

      if (!err) {
        res.send(rows);
      } else {
        console.log(err);
      }

      // if(err) throw err
      // console.log("The data from course table are: \n", rows);
    });
  });
});

router.route("/postcourse").post((req, res) => {
  pool.getConnection((err, connection) => {
    if (err) throw err;

    const params = req.body;
    connection.query(
      "INSERT INTO course VALUES('CS F666', 'BLOCK CHAIN 1', 'WILP', 'Core Course', 'Sem1')",
      (err, rows) => {
        connection.release(); // return the connection to pool
        if (!err) {
          res.send(`record has been added.`);
        } else {
          console.log(err);
        }

        console.log("The data from course table \n", rows);
      }
    );
  });
});

router.route("/add-faculty-preference").post((req, res) => {
  pool.getConnection((err, connection) => {
    const {
      course_id,
      author_id,
      course_code,
      preference,
      facultyrole,
      totalnoofcsstudnets,
      totalnootherdisciplinestudents,
      comments,
      status,
      recordtimestamp,
    } = req.body;

    let faculty_id = author_id;

    // Validate required fields
    if (!faculty_id || !course_code || !preference || !facultyrole) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    // Insert new entry into FACULTYPREFERNCE table
    let insertQuery = `
        INSERT INTO facultypreference (
            faculty_id,
            course_code,
            preference,
            facultyrole,
            totalnoofcsstudnets,
            totalnootherdisciplinestudents
        ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    let values = [
      faculty_id,
      course_code,
      preference,
      facultyrole,
      totalnoofcsstudnets || null,
      totalnootherdisciplinestudents || null,
    ];

    connection.query(insertQuery, values, (err, result) => {
      if (err) {
        console.error("Error inserting into facultypreference:", err);
        return res.status(500).json({
          error: "Failed to add faculty preference" + err.sqlMessage,
        });
      }

      console.log("New entry added to facultypreference:", result.insertId);
    });

    insertQuery = `
    INSERT INTO coursepreference(
        courseid,
        authorid,
        facultyrole,
        totalnoofcsstudnets,
        totalnootherdisciplinestudents,
        comments,
        preferences,
        status,
        recordtimestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    values = [
      course_id,
      author_id,
      facultyrole,
      totalnoofcsstudnets || null,
      totalnootherdisciplinestudents || null,
      comments || null,
      preference,
      status,
      recordtimestamp,
    ];

    connection.query(insertQuery, values, (err, result) => {
      if (err) {
        console.error("Error inserting into COURSEPREFERENCE:", err);
        return res.status(500).json({
          error: "Failed to add course preference" + err.sqlMessage,
        });
      }

      console.log("New entry added to COURSEPREFERENCE:", result.insertId);
      res.status(201).json({
        message: "Course preference added successfully",
      });
    });
  });
});

router.route("/allot-course").post((req, res) => {
  try {
    pool.getConnection((err, connection) => {
      // const query = `
      //   SELECT *
      //   FROM facultypreference
      //   ORDER BY course_code, preference
      // `;

      // const query = `
      //   SELECT *
      //   FROM coursepreference
      //   ORDER BY courseid, preferences
      // `;

      const query = `SELECT courseid, authorid, facultyrole, totalnoofcsstudnets, 
                     totalnootherdisciplinestudents, comments, (SELECT semid FROM sem) as semid 
                     FROM coursepreference ORDER BY courseid, preferences`;

      connection.query(query, async (err, results) => {
        if (err) {
          console.error("Error querying the database:", err);
          res.status(500).json({
            error: "Data could not be fetched from table" + err.sqlMessage,
          });
        }

        // Step 2: Initialize variables to track allocated courses and roles
        const allocatedFaculty = new Set();
        const allocatedRoles = new Set();

        // console.log('results :- ',results);

        // Step 3: Iterate through the sorted preferences and allocate courses
        const finalwrite = [];
        const auth = await getAuthToken();
        clearData(auth);
        results.forEach((preferences) => {
          // const {
          //   faculty_id,
          //   course_code,
          //   preference,
          //   facultyrole,
          //   totalnoofcsstudnets,
          //   totalnootherdisciplinestudents,
          // } = preferences;

          // const {
          //   authorid,
          //   courseid,
          //   Preferences,
          //   facultyrole,
          //   totalnoofcsstudnets,
          //   totalnootherdisciplinestudents,
          // } = preferences;

          const {
            courseid,
            authorid,
            facultyrole,
            totalnoofcsstudnets,
            totalnootherdisciplinestudents,
            comments,
            semid,
            preference,
          } = preferences;

          // Check if the role is already allocated for this course
          if (
            !allocatedRoles.has(`${courseid}-${facultyrole}`) &&
            !allocatedFaculty.has(`${authorid}-${facultyrole}`)
          ) {
            // Allocate the course to the faculty
            console.log(
              `Allocating ${courseid} to ${authorid} with role ${facultyrole}`
            );
            allocatedFaculty.add(`${authorid}-${facultyrole}`);
            allocatedRoles.add(`${courseid}-${facultyrole}`);
            // const data = [
            //   authorid,
            //   courseid,
            //   facultyrole,
            //   totalnoofcsstudnets,
            //   totalnootherdisciplinestudents,
            // ];

            const data = [
              courseid,
              authorid,
              facultyrole,
              totalnoofcsstudnets,
              totalnootherdisciplinestudents,
              comments,
              semid,
            ];

            finalwrite.push(data);
          }
        });
        appendData(auth, finalwrite);
        res.status(201).json({
          message: "Course allocation done",
        });
      });
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      error: "Failed to create sample ALLOC statement",
    });
  }
});

router.route("/allot-ta").post((req, res) => {
  try {
    const sqlResult = `SELECT * FROM tacoursepreference where status = '1'`;

    pool.getConnection((err, connection) => {
      connection.query(sqlResult, async (err, results) => {
        if (err) {
          console.error("Error msg:", err);
          res.status(500).json({
            error: "Error in data fetching" + err.sqlMessage,
          });
        }

        let coursePreferences = results;
        const courseBuckets = {};

        const updatedCoursePreferences = coursePreferences.map((row) => {
          const newRow = { ...row };
          newRow.grade1 = (parseInt(newRow.grade1) || 0) - 1;
          newRow.grade2 = (parseInt(newRow.grade2) || 0) - 2;
          newRow.grade3 = (parseInt(newRow.grade3) || 0) - 3;
          newRow.grade4 = (parseInt(newRow.grade4) || 0) - 4;
          newRow.grade5 = (parseInt(newRow.grade5) || 0) - 5;
          return newRow;
        });

        // now create course buckets
        updatedCoursePreferences.forEach((row) => {
          const sid = row.student_id;
          const cg = row.cgpa;

          for (let i = 1; i <= 5; i++) {
            const coursePreference = `coursepreference${i}`;
            const course = row[coursePreference];
            if (course != null) {
              const gradeNum = `grade${i}`;
              const gradePoint = row[gradeNum];
              if (!courseBuckets[course]) {
                courseBuckets[course] = [];
              }

              courseBuckets[course].push({
                sid,
                cg,
                gradePoint,
              });
            }
          }
        });

        const sortedCourseBuckets = Object.fromEntries(
          Object.entries(courseBuckets).sort(
            (a, b) => a[1].length - b[1].length
          )
        );

        const allottedCourses = {};
        for (const course in sortedCourseBuckets) {
          const students = sortedCourseBuckets[course];
          students.sort((a, b) => {
            if (a.gradePoint !== b.gradePoint) {
              return b.gradePoint - a.gradePoint;
            } else {
              return b.cg - a.cg;
            }
          });
          const allottedStudents = students.slice(0, 5); // Limit to maximum 5 TAs per course
          console.log("Top 5 students here", allottedStudents);
          allottedCourses[course] = allottedStudents;

          // Remove allotted students from the course bucket
          allottedStudents.forEach((student) => {
            for (const course in sortedCourseBuckets) {
              const studentsInCourse = sortedCourseBuckets[course];
              const index = studentsInCourse.findIndex(
                (s) => s.sid === student.sid
              );
              if (index !== -1) {
                studentsInCourse.splice(index, 1);
              }
            }
          });
        }

        const sheetData = [];
        const auth = await getAuthTokenTa();
        sheetData.push(["Course ID", "Student ID", "CGPA", "GradePoint"]);
        for (const course in allottedCourses) {
          const currRow = [];
          currRow.push(course);
          allottedCourses[course].forEach((student) => {
            const studentRow = [];
            studentRow.push(course);
            studentRow.push(student["sid"]);
            studentRow.push(student["cg"]);
            studentRow.push(student["gradePoint"]);
            sheetData.push(studentRow);
          });
        }
        // console.log(sheetData);

        appendDataTa(auth, sheetData);

        // console.log("test :: ", updatedCoursePreferences);
        res.status(201).json({
          result0: coursePreferences[1],
          result1: updatedCoursePreferences[1],
          // courseBuckets: courseBuckets,
          // sortedCourseBuckets: sheetData,
        });
      });
    });
  } catch (error) {
    console.error("Error:", error);
  }
});

//Add TA preference for students
router.route("/allot-ta-allocation").post((req, res) => {
  const sql = `CALL GetDataFotTaAllocation()`;

  const coursepreference1 = `select tacou.coursepreference1, COUNT(tacou.coursepreference1) cnt from tacoursepreference 
                          tacou left join course cou ON tacou.coursepreference1 = cou.courseid
                          GROUP BY tacou.coursepreference1 ORDER BY cnt;`;

  const coursepreference2 = `select tacou.coursepreference2, COUNT(tacou.coursepreference2) cnt from tacoursepreference 
  tacou left join course cou ON tacou.coursepreference2 = cou.courseid
  GROUP BY tacou.coursepreference2 ORDER BY cnt;`;

  const coursepreference3 = `select tacou.coursepreference3, COUNT(tacou.coursepreference3) cnt from tacoursepreference 
  tacou left join course cou ON tacou.coursepreference3 = cou.courseid
  GROUP BY tacou.coursepreference3 ORDER BY cnt;`;

  const coursepreference4 = `select tacou.coursepreference4, COUNT(tacou.coursepreference4) cnt from tacoursepreference 
  tacou left join course cou ON tacou.coursepreference4 = cou.courseid
  GROUP BY tacou.coursepreference4 ORDER BY cnt;`;

  const coursepreference5 = `select tacou.coursepreference5, COUNT(tacou.coursepreference5) cnt from tacoursepreference 
  tacou left join course cou ON tacou.coursepreference5 = cou.courseid
  GROUP BY tacou.coursepreference5 ORDER BY cnt;`;

  // const studentDetails = `select student_id, name,cat, recordtimestamp, coursepreference1, coursepreference2, coursepreference3,
  //                           coursepreference4, coursepreference5 from tacoursepreference WHERE status = 1 ORDER by cat, recordtimestamp,
  //                           coursepreference1, coursepreference2, coursepreference3, coursepreference4, coursepreference5;`;

  const studentDetails = `CALL GetSteudentDetails();`;

  var return_data = {};

  async.parallel(
    [
      function (parallel_done) {
        pool.query(sql, {}, function (err, results) {
          if (err) return parallel_done(err);
          return_data.sql = results[0];
          parallel_done();
        });
      },
      function (parallel_done) {
        pool.query(coursepreference1, {}, function (err, results) {
          if (err) return parallel_done(err);
          return_data.coursepreference1 = results;
          parallel_done();
        });
      },
      function (parallel_done) {
        pool.query(coursepreference2, {}, function (err, results) {
          if (err) return parallel_done(err);
          return_data.coursepreference2 = results;
          parallel_done();
        });
      },
      function (parallel_done) {
        pool.query(coursepreference3, {}, function (err, results) {
          if (err) return parallel_done(err);
          return_data.coursepreference3 = results;
          parallel_done();
        });
      },
      function (parallel_done) {
        pool.query(coursepreference4, {}, function (err, results) {
          if (err) return parallel_done(err);
          return_data.coursepreference4 = results;
          parallel_done();
        });
      },
      function (parallel_done) {
        pool.query(coursepreference5, {}, function (err, results) {
          if (err) return parallel_done(err);
          return_data.coursepreference5 = results;
          parallel_done();
        });
      },
      function (parallel_done) {
        pool.query(studentDetails, {}, function (err, results) {
          if (err) return parallel_done(err);
          return_data.studentDetails = results[0];
          parallel_done();
        });
      },
    ],
    async function (err) {
      if (err) console.log(err);
      // pool.end();

      let phdtacnt = return_data.sql[0]["phdtacnt"];
      let hdtacnt = return_data.sql[0]["hdtacnt"];
      let fdtacnt = return_data.sql[0]["fdtacnt"];

      const finalwrite = [];
      const auth = await getAuthTokenTa();

      clearDataTa(auth);

      // let getPhdPreferenceStudents = return_data.studentDetails.filter(
      //   (i) => i["cat"] === "phd"
      // );

      // let getHdPreferenceStudents = return_data.studentDetails.filter(
      //   (i) => i["cat"] === "hdta1y" || i["cat"] === "hdta2y"
      // );

      // let getFdPreferenceStudents = return_data.studentDetails.filter(
      //   (i) => i["cat"] === "fdta"
      // );

      // let phdPref = [];

      // getPhdPreferenceStudents.forEach((data) => {
      //   phdPref.push(
      //     return_data.coursepreference1.find(
      //       (elem) => data.coursepreference1 === elem.coursepreference1
      //     )
      //   );
      // });

      // Sort phdPref based on cnt (element count)
      // phdPref.sort((a, b) => a.cnt - b.cnt);

      var alloatedCnt = [];
      var dataUpload = [];

      var alloted = 0;

      return_data.studentDetails.forEach((data) => {
        for (let i = 0; i < return_data.sql.length; i++) {
          if (return_data.sql[i]["courseid"] === data.coursepreference1) {
            obj = {
              courseid: return_data.sql[i]["courseid"],
              studcntforcourse: return_data.sql[i]["studcntforcourse"],
              remainingCnt: return_data.sql[i]["studcntforcourse"],
            };
            alloatedCnt.push(obj);
          }
          if (return_data.sql[i]["courseid"] === data.coursepreference2) {
            obj = {
              courseid: return_data.sql[i]["courseid"],
              studcntforcourse: return_data.sql[i]["studcntforcourse"],
              remainingCnt: return_data.sql[i]["studcntforcourse"],
            };
            alloatedCnt.push(obj);
          }
          if (return_data.sql[i]["courseid"] === data.coursepreference3) {
            obj = {
              courseid: return_data.sql[i]["courseid"],
              studcntforcourse: return_data.sql[i]["studcntforcourse"],
              remainingCnt: return_data.sql[i]["studcntforcourse"],
            };
            alloatedCnt.push(obj);
          }
          if (return_data.sql[i]["courseid"] === data.coursepreference4) {
            obj = {
              courseid: return_data.sql[i]["courseid"],
              studcntforcourse: return_data.sql[i]["studcntforcourse"],
              remainingCnt: return_data.sql[i]["studcntforcourse"],
            };
            alloatedCnt.push(obj);
          }
          if (return_data.sql[i]["courseid"] === data.coursepreference5) {
            obj = {
              courseid: return_data.sql[i]["courseid"],
              studcntforcourse: return_data.sql[i]["studcntforcourse"],
              remainingCnt: return_data.sql[i]["studcntforcourse"],
            };
            alloatedCnt.push(obj);
          }
        }
      });

      alloatedCnt = Array.from(new Set(alloatedCnt.map(JSON.stringify)))
        .map(JSON.parse)
        .sort((a, b) => a.studcntforcourse - b.studcntforcourse);

      let studDetails = [];
      let studentDetailsCopy = [];
      let allStudentDetails = return_data.studentDetails;

      //starthere
      //coursepreference1 allotment
      return_data.studentDetails.forEach((data) => {
        studDetails = [];

        studDetails.push(data);

        //student_id, email, name, cgpa, cat, courseid, status, semid
        let {
          recordtimestamp,
          student_id,
          email,
          name,
          cgpa,
          cat,
          coursepreference1,
          cname1,
          statuss,
          semid,
          allotedId,
        } = studDetails[0];

        allotedId = undefined;

        let element = alloatedCnt.find(
          (elem) => elem.courseid === coursepreference1
        );

        alloted = 0;
        dataUpload = [];
        if (element !== undefined && element.remainingCnt > 0) {
          if (allotedId === undefined) {
            if (cat === "phd" && phdtacnt > 0) {
              if (coursepreference1 === element.courseid) {
                allotedId = coursepreference1;
                studentDetailsCopy.push(studDetails[0]);

                dataUpload = [
                  student_id,
                  email,
                  name,
                  cgpa,
                  cat,
                  allotedId,
                  // cname1,
                  statuss,
                  semid,
                ];

                phdtacnt = phdtacnt - 1;

                for (var key in alloatedCnt) {
                  if (alloatedCnt[key].courseid == coursepreference1) {
                    if (alloatedCnt[key].remainingCnt > 0)
                      alloatedCnt[key].remainingCnt--;
                    alloted = 1;
                    break;
                  }
                }
              }
            } else if (
              (data.cat === "hdta1y" || data.cat === "hdta2y") &&
              hdtacnt > 0
            ) {
              allotedId = coursepreference1;
              studentDetailsCopy.push(studDetails[0]);
              dataUpload = [
                student_id,
                email,
                name,
                cgpa,
                cat,
                allotedId,
                // cname1,
                statuss,
                semid,
              ];

              hdtacnt = hdtacnt - 1;

              for (var key in alloatedCnt) {
                if (alloatedCnt[key].courseid == coursepreference1) {
                  if (alloatedCnt[key].remainingCnt > 0)
                    alloatedCnt[key].remainingCnt--;
                  alloted = 1;
                  break;
                }
              }
            } else if (data.cat === "fdta" && fdtacnt > 0) {
              allotedId = coursepreference1;
              studentDetailsCopy.push(studDetails[0]);
              dataUpload = [
                student_id,
                email,
                name,
                cgpa,
                cat,
                allotedId,
                // cname1,
                statuss,
                semid,
              ];

              fdtacnt = fdtacnt - 1;

              for (var key in alloatedCnt) {
                if (alloatedCnt[key].courseid == coursepreference1) {
                  if (alloatedCnt[key].remainingCnt > 0)
                    alloatedCnt[key].remainingCnt--;
                  alloted = 1;
                  break;
                }
              }
            }

            if (alloted === 1) {
              for (var key in return_data.coursepreference1) {
                if (
                  return_data.coursepreference1[key].coursepreference1 ==
                  coursepreference1
                ) {
                  if (return_data.coursepreference1[key].cnt > 0)
                    return_data.coursepreference1[key].cnt--;

                  break;
                }
              }
            }

            alloted = 0;
            if (dataUpload.length > 0) finalwrite.push(dataUpload);
          }
        }
      });

      /* ***************** 2 ****************** */
      // remove allready allotted students
      return_data.studentDetails = return_data.studentDetails.filter(
        (object1) =>
          !studentDetailsCopy.some(
            (object2) => object1.student_id === object2.student_id
          )
      );

      // Sort student details based on created datetime
      return_data.studentDetails.sort(
        (a, b) => a.recordtimestamp - b.recordtimestamp
      );

      studentDetailsCopy = [];
      /* ***************** 2 ****************** */

      //coursepreference2 allotment
      return_data.studentDetails.forEach((data) => {
        studDetails = [];

        studDetails.push(data);

        let {
          recordtimestamp,
          student_id,
          email,
          name,
          cgpa,
          cat,
          coursepreference2,
          cname2,
          statuss,
          semid,
          allotedId,
        } = studDetails[0];

        allotedId = undefined;

        let element = alloatedCnt.find(
          (elem) => elem.courseid === coursepreference2
        );

        alloted = 0;
        dataUpload = [];
        if (element !== undefined && element.remainingCnt > 0) {
          if (allotedId === undefined) {
            if (cat === "phd" && phdtacnt > 0) {
              if (coursepreference2 === element.courseid) {
                allotedId = coursepreference2;
                studentDetailsCopy.push(studDetails[0]);

                dataUpload = [
                  student_id,
                  email,
                  name,
                  cgpa,
                  cat,
                  allotedId,
                  // cname2,
                  statuss,
                  semid,
                ];

                phdtacnt = phdtacnt - 1;

                for (var key in alloatedCnt) {
                  if (alloatedCnt[key].courseid == coursepreference2) {
                    if (alloatedCnt[key].remainingCnt > 0)
                      alloatedCnt[key].remainingCnt--;
                    alloted = 1;
                    break;
                  }
                }
              }
            } else if (
              (data.cat === "hdta1y" || data.cat === "hdta2y") &&
              hdtacnt > 0
            ) {
              allotedId = coursepreference2;
              studentDetailsCopy.push(studDetails[0]);
              dataUpload = [
                student_id,
                email,
                name,
                cgpa,
                cat,
                allotedId,
                // cname2,
                statuss,
                semid,
              ];

              hdtacnt = hdtacnt - 1;

              for (var key in alloatedCnt) {
                if (alloatedCnt[key].courseid == coursepreference2) {
                  if (alloatedCnt[key].remainingCnt > 0)
                    alloatedCnt[key].remainingCnt--;
                  alloted = 1;
                  break;
                }
              }
            } else if (data.cat === "fdta" && fdtacnt > 0) {
              allotedId = coursepreference2;
              studentDetailsCopy.push(studDetails[0]);
              dataUpload = [
                student_id,
                email,
                name,
                cgpa,
                cat,
                allotedId,
                // cname2,
                statuss,
                semid,
              ];

              fdtacnt = fdtacnt - 1;

              for (var key in alloatedCnt) {
                if (alloatedCnt[key].courseid == coursepreference2) {
                  if (alloatedCnt[key].remainingCnt > 0)
                    alloatedCnt[key].remainingCnt--;
                  alloted = 1;
                  break;
                }
              }
            }

            if (alloted === 1) {
              for (var key in return_data.coursepreference2) {
                if (
                  return_data.coursepreference2[key].coursepreference2 ==
                  coursepreference2
                ) {
                  if (return_data.coursepreference2[key].cnt > 0)
                    return_data.coursepreference2[key].cnt--;

                  break;
                }
              }
            }

            alloted = 0;
            if (dataUpload.length > 0) finalwrite.push(dataUpload);
          }
        }
      });

      /* ***************** 3 ****************** */
      // remove allready allotted students
      return_data.studentDetails = return_data.studentDetails.filter(
        (object1) =>
          !studentDetailsCopy.some(
            (object2) => object1.student_id === object2.student_id
          )
      );

      // Sort student details based on created datetime
      return_data.studentDetails.sort(
        (a, b) => a.recordtimestamp - b.recordtimestamp
      );

      studentDetailsCopy = [];
      /* ***************** 3 ****************** */

      //coursepreference3 allotment
      return_data.studentDetails.forEach((data) => {
        studDetails = [];

        studDetails.push(data);

        let {
          recordtimestamp,
          student_id,
          email,
          name,
          cgpa,
          cat,
          coursepreference3,
          cname3,
          statuss,
          semid,
          allotedId,
        } = studDetails[0];

        allotedId = undefined;

        let element = alloatedCnt.find(
          (elem) => elem.courseid === coursepreference3
        );

        alloted = 0;
        dataUpload = [];
        if (element !== undefined && element.remainingCnt > 0) {
          if (allotedId === undefined) {
            if (cat === "phd" && phdtacnt > 0) {
              if (coursepreference3 === element.courseid) {
                allotedId = coursepreference3;
                studentDetailsCopy.push(studDetails[0]);

                dataUpload = [
                  student_id,
                  email,
                  name,
                  cgpa,
                  cat,
                  allotedId,
                  // cname3,
                  statuss,
                  semid,
                ];

                phdtacnt = phdtacnt - 1;

                for (var key in alloatedCnt) {
                  if (alloatedCnt[key].courseid == coursepreference3) {
                    if (alloatedCnt[key].remainingCnt > 0)
                      alloatedCnt[key].remainingCnt--;
                    alloted = 1;
                    break;
                  }
                }
              }
            } else if (
              (data.cat === "hdta1y" || data.cat === "hdta2y") &&
              hdtacnt > 0
            ) {
              allotedId = coursepreference3;
              studentDetailsCopy.push(studDetails[0]);
              dataUpload = [
                student_id,
                email,
                name,
                cgpa,
                cat,
                allotedId,
                // cname3,
                statuss,
                semid,
              ];

              hdtacnt = hdtacnt - 1;

              for (var key in alloatedCnt) {
                if (alloatedCnt[key].courseid == coursepreference3) {
                  if (alloatedCnt[key].remainingCnt > 0)
                    alloatedCnt[key].remainingCnt--;
                  alloted = 1;
                  break;
                }
              }
            } else if (data.cat === "fdta" && fdtacnt > 0) {
              allotedId = coursepreference3;
              studentDetailsCopy.push(studDetails[0]);
              dataUpload = [
                student_id,
                email,
                name,
                cgpa,
                cat,
                allotedId,
                // cname3,
                statuss,
                semid,
              ];

              fdtacnt = fdtacnt - 1;

              for (var key in alloatedCnt) {
                if (alloatedCnt[key].courseid == coursepreference3) {
                  if (alloatedCnt[key].remainingCnt > 0)
                    alloatedCnt[key].remainingCnt--;
                  alloted = 1;
                  break;
                }
              }
            }

            if (alloted === 1) {
              for (var key in return_data.coursepreference3) {
                if (
                  return_data.coursepreference3[key].coursepreference3 ==
                  coursepreference3
                ) {
                  if (return_data.coursepreference3[key].cnt > 0)
                    return_data.coursepreference3[key].cnt--;

                  break;
                }
              }
            }

            alloted = 0;
            if (dataUpload.length > 0) finalwrite.push(dataUpload);
          }
        }
      });

      /* ***************** 4 ****************** */
      // remove allready allotted students
      return_data.studentDetails = return_data.studentDetails.filter(
        (object1) =>
          !studentDetailsCopy.some(
            (object2) => object1.student_id === object2.student_id
          )
      );

      // Sort student details based on created datetime
      return_data.studentDetails.sort(
        (a, b) => a.recordtimestamp - b.recordtimestamp
      );

      studentDetailsCopy = [];
      /* ***************** 4 ****************** */

      //coursepreference4 allotment
      return_data.studentDetails.forEach((data) => {
        studDetails = [];

        studDetails.push(data);

        let {
          recordtimestamp,
          student_id,
          email,
          name,
          cgpa,
          cat,
          coursepreference4,
          cname4,
          statuss,
          semid,
          allotedId,
        } = studDetails[0];

        allotedId = undefined;

        let element = alloatedCnt.find(
          (elem) => elem.courseid === coursepreference4
        );

        alloted = 0;
        dataUpload = [];
        if (element !== undefined && element.remainingCnt > 0) {
          if (allotedId === undefined) {
            if (cat === "phd" && phdtacnt > 0) {
              if (coursepreference4 === element.courseid) {
                allotedId = coursepreference4;
                studentDetailsCopy.push(studDetails[0]);

                dataUpload = [
                  student_id,
                  email,
                  name,
                  cgpa,
                  cat,
                  allotedId,
                  // cname4,
                  statuss,
                  semid,
                ];

                phdtacnt = phdtacnt - 1;

                for (var key in alloatedCnt) {
                  if (alloatedCnt[key].courseid == coursepreference4) {
                    if (alloatedCnt[key].remainingCnt > 0)
                      alloatedCnt[key].remainingCnt--;
                    alloted = 1;
                    break;
                  }
                }
              }
            } else if (
              (data.cat === "hdta1y" || data.cat === "hdta2y") &&
              hdtacnt > 0
            ) {
              allotedId = coursepreference4;
              studentDetailsCopy.push(studDetails[0]);
              dataUpload = [
                student_id,
                email,
                name,
                cgpa,
                cat,
                allotedId,
                // cname4,
                statuss,
                semid,
              ];

              hdtacnt = hdtacnt - 1;

              for (var key in alloatedCnt) {
                if (alloatedCnt[key].courseid == coursepreference4) {
                  if (alloatedCnt[key].remainingCnt > 0)
                    alloatedCnt[key].remainingCnt--;
                  alloted = 1;
                  break;
                }
              }
            } else if (data.cat === "fdta" && fdtacnt > 0) {
              allotedId = coursepreference4;
              studentDetailsCopy.push(studDetails[0]);
              dataUpload = [
                student_id,
                email,
                name,
                cgpa,
                cat,
                allotedId,
                // cname4,
                statuss,
                semid,
              ];

              fdtacnt = fdtacnt - 1;

              for (var key in alloatedCnt) {
                if (alloatedCnt[key].courseid == coursepreference4) {
                  if (alloatedCnt[key].remainingCnt > 0)
                    alloatedCnt[key].remainingCnt--;
                  alloted = 1;
                  break;
                }
              }
            }

            if (alloted === 1) {
              for (var key in return_data.coursepreference4) {
                if (
                  return_data.coursepreference4[key].coursepreference4 ==
                  coursepreference4
                ) {
                  if (return_data.coursepreference4[key].cnt > 0)
                    return_data.coursepreference4[key].cnt--;

                  break;
                }
              }
            }

            alloted = 0;
            if (dataUpload.length > 0) finalwrite.push(dataUpload);
          }
        }
      });

      /* ***************** 5 ****************** */
      // remove allready allotted students
      return_data.studentDetails = return_data.studentDetails.filter(
        (object1) =>
          !studentDetailsCopy.some(
            (object2) => object1.student_id === object2.student_id
          )
      );

      // Sort student details based on created datetime
      return_data.studentDetails.sort(
        (a, b) => a.recordtimestamp - b.recordtimestamp
      );

      studentDetailsCopy = [];
      /* ***************** 5 ****************** */

      //coursepreference5 allotment
      return_data.studentDetails.forEach((data) => {
        studDetails = [];

        studDetails.push(data);

        let {
          recordtimestamp,
          student_id,
          email,
          name,
          cgpa,
          cat,
          coursepreference5,
          cname5,
          statuss,
          semid,
          allotedId,
        } = studDetails[0];

        allotedId = undefined;

        let element = alloatedCnt.find(
          (elem) => elem.courseid === coursepreference5
        );

        alloted = 0;
        dataUpload = [];
        if (element !== undefined && element.remainingCnt > 0) {
          if (allotedId === undefined) {
            if (cat === "phd" && phdtacnt > 0) {
              if (coursepreference5 === element.courseid) {
                allotedId = coursepreference5;
                studentDetailsCopy.push(studDetails[0]);

                dataUpload = [
                  student_id,
                  email,
                  name,
                  cgpa,
                  cat,
                  allotedId,
                  // cname5,
                  statuss,
                  semid,
                ];

                phdtacnt = phdtacnt - 1;

                for (var key in alloatedCnt) {
                  if (alloatedCnt[key].courseid == coursepreference5) {
                    if (alloatedCnt[key].remainingCnt > 0)
                      alloatedCnt[key].remainingCnt--;
                    alloted = 1;
                    break;
                  }
                }
              }
            } else if (
              (data.cat === "hdta1y" || data.cat === "hdta2y") &&
              hdtacnt > 0
            ) {
              allotedId = coursepreference5;
              studentDetailsCopy.push(studDetails[0]);
              dataUpload = [
                student_id,
                email,
                name,
                cgpa,
                cat,
                allotedId,
                // cname5,
                statuss,
                semid,
              ];

              hdtacnt = hdtacnt - 1;

              for (var key in alloatedCnt) {
                if (alloatedCnt[key].courseid == coursepreference5) {
                  if (alloatedCnt[key].remainingCnt > 0)
                    alloatedCnt[key].remainingCnt--;
                  alloted = 1;
                  break;
                }
              }
            } else if (data.cat === "fdta" && fdtacnt > 0) {
              allotedId = coursepreference5;
              studentDetailsCopy.push(studDetails[0]);
              dataUpload = [
                student_id,
                email,
                name,
                cgpa,
                cat,
                allotedId,
                // cname5,
                statuss,
                semid,
              ];

              fdtacnt = fdtacnt - 1;

              for (var key in alloatedCnt) {
                if (alloatedCnt[key].courseid == coursepreference5) {
                  if (alloatedCnt[key].remainingCnt > 0)
                    alloatedCnt[key].remainingCnt--;
                  alloted = 1;
                  break;
                }
              }
            }

            if (alloted === 1) {
              for (var key in return_data.coursepreference5) {
                if (
                  return_data.coursepreference5[key].coursepreference5 ==
                  coursepreference5
                ) {
                  if (return_data.coursepreference5[key].cnt > 0)
                    return_data.coursepreference5[key].cnt--;

                  break;
                }
              }
            }

            alloted = 0;
            if (dataUpload.length > 0) finalwrite.push(dataUpload);
          }
        }
      });

      /* ***************** remaining students ****************** */
      // remove allready allotted students
      return_data.studentDetails = return_data.studentDetails.filter(
        (object1) =>
          !studentDetailsCopy.some(
            (object2) => object1.student_id === object2.student_id
          )
      );

      // Sort student details based on created datetime
      return_data.studentDetails.sort(
        (a, b) => a.recordtimestamp - b.recordtimestamp
      );

      studentDetailsCopy = [];
      /* ***************** remaining students ****************** */

      // Sort alloatedCnt
      alloatedCnt.sort((a, b) => b.remainingCnt - a.remainingCnt);

      //remaining all allotment
      return_data.studentDetails.forEach((data) => {
        studDetails = [];

        studDetails.push(data);

        let {
          recordtimestamp,
          student_id,
          email,
          name,
          cgpa,
          cat,
          coursepreference,
          cname,
          statuss,
          semid,
          allotedId,
        } = studDetails[0];

        allotedId = undefined;

        alloted = 0;
        dataUpload = [];
        for (var key in alloatedCnt) {
          if (phdtacnt > 0 || hdtacnt > 0 || fdtacnt > 0) {
            if (alloatedCnt[key].remainingCnt >= 0) {
              allotedId = alloatedCnt[key].courseid;
              studentDetailsCopy.push(studDetails[0]);
              dataUpload = [
                student_id,
                email,
                name,
                cgpa,
                cat,
                allotedId,
                // cname5,
                statuss,
                semid,
              ];

              alloatedCnt[key].remainingCnt--;

              if (cat === "phd") {
                phdtacnt = phdtacnt - 1;
              } else if (cat === "hdta1y" || cat === "hdta2y") {
                hdtacnt = hdtacnt - 1;
              } else if (cat === "fdta") {
                fdtacnt = fdtacnt - 1;
              }
              break;
            }
          }
        }

        // console.log(alloatedCnt);
        // if (dataUpload.length > 0) finalwrite.push(dataUpload);
      });

      /* ***************** remaining students ****************** */
      if (return_data.studentDetails.length > 0) {
        // remove allready allotted students
        return_data.studentDetails = return_data.studentDetails.filter(
          (object1) =>
            !studentDetailsCopy.some(
              (object2) => object1.student_id === object2.student_id
            )
        );

        // Sort student details based on created datetime
        return_data.studentDetails.sort(
          (a, b) => a.recordtimestamp - b.recordtimestamp
        );

        studentDetailsCopy = [];

        /* ***************** remaining students ****************** */

        return_data.studentDetails.forEach((data) => {
          //conf1
          dataUpload = [];
          studDetails = [];
          studDetails.push(data);

          let {
            recordtimestamp,
            student_id,
            email,
            name,
            cgpa,
            cat,
            coursepreference1,
            cname,
            statuss,
            semid,
            allotedId,
          } = studDetails[0];

          allotedId = undefined;

          for (let i = 0; i < return_data.coursepreference1.length; i++) {
            allotedId = data.coursepreference1;
            studentDetailsCopy.push(studDetails[0]);
            dataUpload = [
              student_id,
              email,
              name,
              cgpa,
              cat,
              allotedId,
              // cname1,
              statuss,
              semid,
            ];
            break;
          }

          if (dataUpload.length > 0) finalwrite.push(dataUpload);
        });

        // remove allready allotted students
        return_data.studentDetails = return_data.studentDetails.filter(
          (object1) =>
            !studentDetailsCopy.some(
              (object2) => object1.student_id === object2.student_id
            )
        );

        // Sort student details based on created datetime
        return_data.studentDetails.sort(
          (a, b) => a.recordtimestamp - b.recordtimestamp
        );

        // //conf2
        return_data.studentDetails.forEach((data) => {
          //conf2
          dataUpload = [];
          studDetails = [];
          studDetails.push(data);

          let {
            recordtimestamp,
            student_id,
            email,
            name,
            cgpa,
            cat,
            coursepreference2,
            cname,
            statuss,
            semid,
            allotedId,
          } = studDetails[0];

          allotedId = undefined;

          for (let i = 0; i < return_data.coursepreference2.length; i++) {
            allotedId = data.coursepreference2;
            studentDetailsCopy.push(studDetails[0]);
            dataUpload = [
              student_id,
              email,
              name,
              cgpa,
              cat,
              allotedId,
              // cname1,
              statuss,
              semid,
            ];
            break;
          }

          if (dataUpload.length > 0) finalwrite.push(dataUpload);
        });

        // remove allready allotted students
        return_data.studentDetails = return_data.studentDetails.filter(
          (object1) =>
            !studentDetailsCopy.some(
              (object2) => object1.student_id === object2.student_id
            )
        );

        // Sort student details based on created datetime
        return_data.studentDetails.sort(
          (a, b) => a.recordtimestamp - b.recordtimestamp
        );

        // //conf3
        return_data.studentDetails.forEach((data) => {
          //conf3
          dataUpload = [];
          studDetails = [];
          studDetails.push(data);

          let {
            recordtimestamp,
            student_id,
            email,
            name,
            cgpa,
            cat,
            coursepreference3,
            cname,
            statuss,
            semid,
            allotedId,
          } = studDetails[0];

          allotedId = undefined;

          for (let i = 0; i < return_data.coursepreference3.length; i++) {
            allotedId = data.coursepreference3;
            studentDetailsCopy.push(studDetails[0]);
            dataUpload = [
              student_id,
              email,
              name,
              cgpa,
              cat,
              allotedId,
              // cname1,
              statuss,
              semid,
            ];
            break;
          }

          if (dataUpload.length > 0) finalwrite.push(dataUpload);
        });

        // remove allready allotted students
        return_data.studentDetails = return_data.studentDetails.filter(
          (object1) =>
            !studentDetailsCopy.some(
              (object2) => object1.student_id === object2.student_id
            )
        );

        // Sort student details based on created datetime
        return_data.studentDetails.sort(
          (a, b) => a.recordtimestamp - b.recordtimestamp
        );

        // //conf4
        return_data.studentDetails.forEach((data) => {
          //conf4
          dataUpload = [];
          studDetails = [];
          studDetails.push(data);

          let {
            recordtimestamp,
            student_id,
            email,
            name,
            cgpa,
            cat,
            coursepreference4,
            cname,
            statuss,
            semid,
            allotedId,
          } = studDetails[0];

          allotedId = undefined;

          for (let i = 0; i < return_data.coursepreference4.length; i++) {
            allotedId = data.coursepreference4;
            studentDetailsCopy.push(studDetails[0]);
            dataUpload = [
              student_id,
              email,
              name,
              cgpa,
              cat,
              allotedId,
              // cname1,
              statuss,
              semid,
            ];
            break;
          }

          if (dataUpload.length > 0) finalwrite.push(dataUpload);
        });

        // remove allready allotted students
        return_data.studentDetails = return_data.studentDetails.filter(
          (object1) =>
            !studentDetailsCopy.some(
              (object2) => object1.student_id === object2.student_id
            )
        );

        // Sort student details based on created datetime
        return_data.studentDetails.sort(
          (a, b) => a.recordtimestamp - b.recordtimestamp
        );

        // //conf5
        return_data.studentDetails.forEach((data) => {
          //conf5
          dataUpload = [];
          studDetails = [];
          studDetails.push(data);

          let {
            recordtimestamp,
            student_id,
            email,
            name,
            cgpa,
            cat,
            coursepreference5,
            cname,
            statuss,
            semid,
            allotedId,
          } = studDetails[0];

          allotedId = undefined;

          for (let i = 0; i < return_data.coursepreference5.length; i++) {
            allotedId = data.coursepreference5;
            studentDetailsCopy.push(studDetails[0]);
            dataUpload = [
              student_id,
              email,
              name,
              cgpa,
              cat,
              allotedId,
              // cname1,
              statuss,
              semid,
            ];
            break;
          }

          if (dataUpload.length > 0) finalwrite.push(dataUpload);
        });

        // remove allready allotted students
        return_data.studentDetails = return_data.studentDetails.filter(
          (object1) =>
            !studentDetailsCopy.some(
              (object2) => object1.student_id === object2.student_id
            )
        );

        // Sort student details based on created datetime
        return_data.studentDetails.sort(
          (a, b) => a.recordtimestamp - b.recordtimestamp
        );
      }

      /* ***************** remaining students ****************** */

      appendDataTa(auth, finalwrite);
      res.status(201).json({
        // remainingStudentDetails: return_data.studentDetails,
        message: "message",
      });

      // res.send(return_data);
    }
  );
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
