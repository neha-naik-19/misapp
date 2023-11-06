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

const googleSheetService = {
  type: "service_account",
  project_id: "course-401211",
  private_key_id: "aab35f99fe9b38e39c9bed3d9142c7a7cba73015",
  private_key:
    "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQD4ROG8pNFzDeDo\ndaXocy1DEwVhj2Q6hknR/a4FsPuLXmRa7z+SSkq5riVoEYwWblOX6JJbLXYcNOgE\nCvozW3LLhaMdEGuP5KMxKo5znd8ouE4BNlG9oy0BEYJ4r2prkT24w8J8KNwjTzDZ\n1Xi9EsOqqiv4fWU6AZp8FsJ0hePzjDRCo35TDNf/+Xr4a441l4b68A03Q77F/vXG\nxPEPu4FQjfrV2+edHzsXRoJdGxFfX+4eSalVObhv8QZ60+HlQSgxJPGjvDcM/Vio\nGVBOqL1SDTGJJxRAtCgdU3lon664x70SZ7I30N6+9yMMHN+4r5p6SYggBF+7c+ZG\nUeJjE+mdAgMBAAECggEACdWQq4xLz6bpFcwzOjX1wQZr3CV17uuK2QqXbhpInIis\nqP15Iy5WL2y6hpjLV8ge/5Fy2rG+T/e4iRB2QLqKnY05nNkdqaGA5V2uLt4+DLrg\nPCQOsNhZ3AT5ihZIvOIP89WtSoXD0pI8eSR/l926anQ7Mail7dpKaEfug/cZxHfh\nUM8Q/fMvdLPnuWBC1STvsxGTsRgAHN9eUk2aqg7bvki4Yj4k7JgR5SrirkIrtRN9\nLl4Pnz6LTvo2fblrQm7HcHJi8h0neUzTT6sDy0kckvW1xtt/aBfKcls4QVAzfJrt\nr13iMk+fyU0nSIEAtLuY0SQfAW60nrVJ3YMZlxgc8QKBgQD+qc2oHS3YDJ5r2u1G\nXVUJLstFC8z0CoJ1Mbs2Gh9ZN4bjhpgp8lrmKnc6+kwZeuZXKsapG/EPaA1eGUJP\n/YfGOTynFwqAXk/D33W4uGvMkUvnrIrDioAmdcrig2WPQnC5Z42WHNqFIoaxC8FB\nC/ZreZvwRq0+MrYfO+FaNYdZewKBgQD5knyDRmuuT1OFuB7NbP3F+1onwizpBOff\newLt4I3HWBgvFD3n/3nt2cyIW5/VpjsLIbzKDhMoSgHixDDU+g/6TbfVWQLQeWW6\n/z0WX7bXG0EExso+NnrB743asFNJ+9JAlM4fPeOamsTM9OP7MzO0pkF/ole3rmus\nuw8wyZWhxwKBgFXzK3UM/BcKE0HlruVrxLKHt5VDKVZIYcV6FmxpHqF26zDJkXu+\nz00Vkg42wg5re2h6CHi09IQ1oyVaMxZaREPzt3PRg/rVWeiK9+lzXPa7Jzo28tKS\nYTQZ13Lh1Boo23DH8XJzpJEAmSMSC5SPnAikD6xlvjza0rrx89oFbPwXAoGAdNYw\nNmDMXoFCj7JfsToaIAqI7V4JGlmyl7wF5gkfNri2MawfQzImCcTR7PBABoxYzeBQ\neqNWMqFa+qdwWPRscHjb3CRcne6HQqDlH0lV1qQqryrFWZS1qX8VgNDVXShoCNXh\nHV0i5akZAv6OkHYq+aJvvWnp+NLOE8JK3UMyKtcCgYBYts3pMFV0Rfe+2tsUizcE\nC4xJs3TmAp76hh81SXczlbCdgdNdRk1hodZ2oIN+3ttkJWjBzJn1ohbHsQ8P6v+f\nYYYfN9JZBFQ37frepEje4Rsp5Mw8DLKcxW0yhIA1fiHC0NamJpnPkAfcqG/3SZ4r\n+E4/GwClaaoceYO8CVZgrQ==\n-----END PRIVATE KEY-----\n",
  client_email: "coursessheet@course-401211.iam.gserviceaccount.com",
  client_id: "108421166814540107562",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:
    "https://www.googleapis.com/robot/v1/metadata/x509/coursessheet%40course-401211.iam.gserviceaccount.com",
  universe_domain: "googleapis.com",
};

// const { getAuthToken, appendData } = require("./googleSheetsService.js");

const { getAuthToken, appendData } = googleSheetService;

// Multer middleware for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());

app.use("/api", router);

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
