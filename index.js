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

const port = 3002;

const { getAuthToken, appendData } = require("./googleSheetsService.js");

const {
  getAuthTokenTa,
  appendDataTa,
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

router.route("/post_ta_allocation").post((req, res) => {
  pool.getConnection((err, connection) => {
    if (err) throw err;

    const params = req.body;
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

//allot course to faculty and update in Google Sheet
// router.route("/allot-course1").post((req, res) => {
//   try {
//     pool.getConnection((err, connection) => {
//       const query = `
//         SELECT *
//         FROM facultypreference
//         ORDER BY course_code, preference
//       `;

//       connection.query(query, async (err, results) => {
//         if (err) {
//           console.error("Error querying the database:", err);
//           res.status(500).json({
//             error: "Data could not be fetched from table" + err.sqlMessage,
//           });
//         }

//         // Step 2: Initialize variables to track allocated courses and roles
//         const allocatedFaculty = new Set();
//         const allocatedRoles = new Set();

//         // Step 3: Iterate through the sorted preferences and allocate courses
//         const finalwrite = [];
//         const auth = await getAuthToken();
//         results.forEach((preferences) => {
//           //courseid, authorid, facultyrole, totalnoofcsstudnets, totalnootherdisciplinestudents, comments, semid
//           const {
//             course_code,
//             faculty_id,
//             facultyrole,
//             totalnoofcsstudnets,
//             totalnootherdisciplinestudents,
//             comments,
//             semid,
//             preference,
//           } = preferences;

//           // Check if the role is already allocated for this course
//           if (
//             !allocatedRoles.has(`${course_code}-${facultyrole}`) &&
//             !allocatedFaculty.has(`${faculty_id}-${facultyrole}`)
//           ) {
//             // Allocate the course to the faculty
//             console.log(
//               `Allocating ${course_code} to ${faculty_id} with role ${facultyrole}`
//             );
//             allocatedFaculty.add(`${faculty_id}-${facultyrole}`);
//             allocatedRoles.add(`${course_code}-${facultyrole}`);
//             //courseid, authorid, facultyrole, totalnoofcsstudnets, totalnootherdisciplinestudents, comments, semid
//             // const data = [
//             //   faculty_id,
//             //   course_code,
//             //   facultyrole,
//             //   totalnoofcsstudnets,
//             //   totalnootherdisciplinestudents,
//             // ];

//             const data = [
//               course_code,
//               faculty_id,
//               facultyrole,
//               totalnoofcsstudnets,
//               totalnootherdisciplinestudents,
//               comments,
//               semid,
//               // preference,
//             ];
//             finalwrite.push(data);
//           }
//         });
//         appendData(auth, finalwrite);
//         res.status(201).json({
//           message: "Course allocation done",
//         });
//       });
//     });
//   } catch (error) {
//     console.error("Error:", error);
//     res.status(500).json({
//       error: "Failed to create sample ALLOC statement",
//     });
//   }
// });

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

      const finalwrite = [];
      const auth = await getAuthTokenTa();

      let getPhdPreferenceStudents = return_data.studentDetails.filter(
        (i) => i["cat"] === "phd"
      );

      let getHdPreferenceStudents = return_data.studentDetails.filter(
        (i) => i["cat"] === "hdta1y" || i["cat"] === "hdta2y"
      );

      let getFdPreferenceStudents = return_data.studentDetails.filter(
        (i) => i["cat"] === "fdta"
      );

      let pref1 = [];

      getPhdPreferenceStudents.forEach((data) => {
        pref1.push(
          return_data.coursepreference1.filter(
            (elem) => data.coursepreference1 === elem.coursepreference1
          )
        );
      });

      // const pref1 = getPhdPreferenceStudents.map((data) => {
      //   const filtered = return_data.coursepreference1.filter(
      //     (elem) => data.coursepreference1 === elem.coursepreference1
      //   );
      //   return {
      //     data: data.coursepreference1,
      //     filteredData: filtered,
      //     cnt: filtered.length, // Element count
      //   };
      // });

      // Sort pref1 based on cnt (element count) in ascending order
      // pref1.sort((a, b) => a.cnt - b.cnt);

      let result = [];
      let i = 0;

      return_data.studentDetails.forEach((data) => {
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
          alloted,
        } = data;

        for (let index = 0; index < getPhdPreferenceStudents.length; index++) {
          if (student_id === getPhdPreferenceStudents[index]["student_id"]) {
            if (alloted === undefined) alloted = coursepreference1;
            break;
          }
        }

        for (let index = 0; index < getHdPreferenceStudents.length; index++) {
          if (student_id === getHdPreferenceStudents[index]["student_id"]) {
            if (alloted === undefined) alloted = coursepreference1;
            break;
          }
        }

        for (let index = 0; index < getFdPreferenceStudents.length; index++) {
          if (student_id === getFdPreferenceStudents[index]["student_id"]) {
            if (alloted === undefined) alloted = coursepreference1;
            break;
          }
        }

        // result.push({
        //   recordtimestamp,
        //   cat,
        //   student_id,
        //   name,
        //   coursepreference1,
        //   cname1,
        //   alloted,
        // });

        // console.log(result);

        result.forEach((data) => {
          for (let index = 0; index < sql.length; index++) {
            const element = sql[index]["courseid"];
          }
        });

        // for (let index = 0; index < pref1.length; index++) {
        //   const element = pref1[index];
        //   console.log(element);

        //   // result.push(student_id: )
        // }

        // alloted = "test";

        //student_id, email, name, cgpa, cat, courseid, status, semid
        // const data1 = [
        //   moment(recordtimestamp).format("YYYY/MM/DD HH:mm:ss"),
        //   student_id,
        //   cat,
        //   name,
        //   alloted,
        // ];

        const data1 = [
          student_id,
          email,
          name,
          cgpa,
          cat,
          alloted,
          // cname1,
          statuss,
          semid,
        ];
        finalwrite.push(data1);
      });

      // console.log(typeof return_data.studentDetails);

      // console.log(getHdPreferenceStudents);

      // return_data.studentDetails.forEach((data) => {
      //   const { student_id, name, cat, recordtimestamp } = data;

      //   const data1 = [student_id, name, cat, recordtimestamp];
      // finalwrite.push(data1);
      // });

      appendDataTa(auth, finalwrite);
      res.status(201).json({
        // message: "TA allocation done",
        // message: return_data.studentDetails,
        // phd: return_data.coursepreference1,
        pref: return_data.studentDetails,
        // 1: return_data.coursepreference1,
      });

      // res.send(return_data);
    }
  );
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
