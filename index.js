const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const router = express.Router();
const app = express();
var cors = require("cors");
const { response, request } = require("express");

// const ContentSecurityPolicy = `font-src 'self' js.stripe.com`;

const port = 3000;

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
  host: "localhost",
  user: "root",
  password: "",
  database: "csis",
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

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
