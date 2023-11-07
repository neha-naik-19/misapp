const express = require("express");
const multer = require("multer");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const xlsx = require("xlsx");
const router = express.Router();
const app = express();
var cors = require("cors");
const { response, request } = require("express");

const port = 3000;

const { getAuthToken, appendData } = require("./googleSheetsService.js");

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
            courseid,
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
      const query = `
        SELECT *
        FROM facultypreference
        ORDER BY course_code, preference
      `;

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

        // Step 3: Iterate through the sorted preferences and allocate courses
        const finalwrite = [];
        const auth = await getAuthToken();
        results.forEach((preferences) => {
          const {
            faculty_id,
            course_code,
            preference,
            facultyrole,
            totalnoofcsstudnets,
            totalnootherdisciplinestudents,
          } = preferences;

          // Check if the role is already allocated for this course
          if (
            !allocatedRoles.has(`${course_code}-${facultyrole}`) &&
            !allocatedFaculty.has(`${faculty_id}-${facultyrole}`)
          ) {
            // Allocate the course to the faculty
            console.log(
              `Allocating ${course_code} to ${faculty_id} with role ${facultyrole}`
            );
            allocatedFaculty.add(`${faculty_id}-${facultyrole}`);
            allocatedRoles.add(`${course_code}-${facultyrole}`);
            const data = [
              faculty_id,
              course_code,
              facultyrole,
              totalnoofcsstudnets,
              totalnootherdisciplinestudents,
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

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
