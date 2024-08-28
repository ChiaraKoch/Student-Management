import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport, { Passport } from "passport";
import { Strategy } from "passport-local";
import session from "express-session";
import env from "dotenv";
import flash from "connect-flash";

const app = express();
app.set('view engine', 'ejs');
app.set('views', './views');  // Specify the views directory
const port = 3000;
const saltRounds = 10;
env.config();

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

app.use(flash());

const db = new pg.Client({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
})
db.connect();

app.use(bodyParser.urlencoded({ extended : true }));
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());

app.get("/", async (req, res) => {
    res.render("home.ejs")
})

app.get("/student-log", async (req, res) => {
  console.log(req.user);

  let year = new Date().getFullYear();

  try {
    if (req.isAuthenticated()) {
      const username = req.user.username;

      // Fetch the parish name associated with the logged-in user
      const userParish = await db.query("SELECT username FROM users WHERE username = $1", [username]);

      if (userParish.rows.length > 0) {
        const parishName = userParish.rows[0].username;

        // Fetch all students associated with the user's parish name
        const student_info = await db.query(
          "SELECT id, name, surname, age, birthday, confirmation_year, cell_number, allergies, school, parent_name, parent_surname, parent_number, parent_email FROM students WHERE parish_email = $1", 
          [parishName]
        );

        if (student_info.rows.length > 0) {
          res.render("student-log.ejs", {
            title: `The Year of Our Lord ${year}`,
            student_info: student_info.rows,
          });
        } else {
          res.render("student-log.ejs", {
            title: `The Year of Our Lord ${year}`,
            student_info: [],
            message: "No students found for your parish.",
          });
        }
      } else {
        res.redirect("/login");
      }
    } else {
      res.redirect("/login");
    } 
  } catch (err) {
    console.log(err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/login", async(req, res) => {
    res.render("login.ejs")
});

app.get("/register", async(req, res) => {
    res.render("register.ejs")
});

app.get("/reg-student", async(req, res) => {
    res.render("reg-student.ejs")
});

app.get("/class-list", async(req, res) => {
  console.log(req.user);

  let year = new Date().getFullYear();

  try {
    if (req.isAuthenticated()) {
      const username = req.user.username;

      // Fetch the parish name associated with the logged-in user
      const userParish = await db.query("SELECT username FROM users WHERE username = $1", [username]);

      if (userParish.rows.length > 0) {
        const parishName = userParish.rows[0].username;

        // Fetch all students associated with the user's parish name
        const student_info = await db.query(
          "SELECT name, surname, age, birthday, confirmation_year FROM students WHERE parish_email = $1", 
          [parishName]
        );

        if (student_info.rows.length > 0) {
          res.render("class-list.ejs", {
            title: `Class List ${year}`,
            student_info: student_info.rows,
          });
        } else {
          res.render("student-log.ejs", {
            title: `The Year of Our Lord ${year}`,
            year: year,
            student_info: [],
            message: "No students found for your parish.",
          });
        }
      } else {
        res.redirect("/login");
      }
    } else {
      res.redirect("/login");
    } 
  } catch (err) {
    console.log(err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/logout", (req, res) => {
    req.logout(function (err) {
      if (err) {
        return next(err);
      }
      res.redirect("/");
    });
  });

app.post("/login", passport.authenticate("local", {
  successRedirect: "/student-log",
  failureRedirect: "/login",
  failureFlash: true,
})
);

app.post("/reg-student", async(req, res) => {
  
  // parent info and student info
  const {parent_name, parent_surname, parent_number, parent_email, child_name, child_surname, cell_number, age, birthday, year, school, allergies, parish_email} = req.body;

  try {
    const student_result = await db.query("INSERT INTO students (name, surname, age, birthday, confirmation_year, allergies, school, parish_email, cell_number, parent_name, parent_surname, parent_number, parent_email) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)", 
      [child_name, child_surname, age, birthday, year, allergies, school, parish_email, cell_number, parent_name, parent_surname, parent_number, parent_email]
    );
    res.redirect("/login");
  } catch (err) {
    console.log(err)
  }
})

app.post("/register", async(req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE username = $1", [email,
    ]);
    
    if (checkResult.rows.length > 0) {
      res.redirect("/login");
    } else{
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
        } else {
          const result = await db.query(
            "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *", 
            [email, hash]
          );
          const user = result.rows[0];
          req.login(user, (err) => {
            console.log("Success");
            res.redirect("/student-log")
          });
        }
      });
    }
  } catch (err) {
    console.log(err);
  }
});

passport.use(
  "local",
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.query("SELECT * FROM users WHERE username = $1", [
        username,
      ]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            return cb(err);
          } else {
            if (valid) {
              return cb(null, user);
            } else {
              return cb(null, false, { message: "Incorrect password" });
            }
          }
        });
      } else {
        return cb(null, false, { message: "User not found" });;
      }
    } catch (err) {
      console.log(err);
    }
    
  })
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.post("/deleteStudent", async (req, res) => {

  const clickId = req.body.studentId;
  try {
    await db.query("DELETE FROM students WHERE id=$1", [clickId]);
    res.redirect("/class-list");
  } catch(err) {
    console.log(err);
    res.status(500).send("Internal Server Error");
  }
})

app.get("/edit-student/:id", async (req, res) => {
  const studentId = req.params.id;

  console.log("Fetching student details for ID:", studentId);

  try {
    const result = await db.query("SELECT * FROM students WHERE id=$1", [studentId]);

    if (result.rows.length === 0) {
      console.log("No student found with ID:", studentId);
      return res.status(404).send("Student Not Found");
    }

    const student = result.rows[0];
    console.log("Student found:", student);

    res.render("edit-student", { student });
  } catch (err) {
    console.log("Error fetching student details:", err.message);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/editStudent", async (req, res) => {
  const { studentId, name, surname, cell_number, parent_name, parent_surname, parent_email, confirmation_year, school, allergies, age, birthday, parent_number } = req.body;

  try {
      await db.query(
          "UPDATE students SET name=$1, surname=$2, age=$3, birthday=$4, confirmation_year=$5, cell_number=$6, allergies=$7, school=$8, parent_name=$9, parent_surname=$10, parent_number=$11, parent_email=$12 WHERE id=$13",
          [name, surname, age, birthday, confirmation_year, cell_number, allergies, school, parent_name, parent_surname, parent_number, parent_email, studentId]
      );
      res.redirect("/student-log");  // Redirect back to the student log after saving changes
  } catch (err) {
      console.log("Error during update:", err);
      res.status(500).send("Internal Server Error");
  }
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});