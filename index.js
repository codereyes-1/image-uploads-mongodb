require("dotenv").config();
const upload = require("./routes/upload");
// const { ObjectID } = require("mongodb");
const mongoose = require("mongoose");
const connection = require("./config/db");
const express = require("express");
const fs = require("fs")
const multer = require("multer"); // Import multer middleware
const { GridFSBucket, ObjectID } = require("mongodb");
const app = express();

let gfs;
connection();

const conn = mongoose.connection;
conn.once("open", async function () {
    const db = conn.db;
    gfs = new GridFSBucket(db, { bucketName: "photos" });
});

// Configure multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/"); // Define the destination folder for uploaded files
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname); // Use the original file name as the uploaded file name
    }
});

// Create multer upload middleware
const uploadMiddleware = multer({ storage: storage });

app.use("/file", upload); // Existing route handler for GET and DELETE methods

// Add route handler for file uploads using POST method
app.post("/file", uploadMiddleware.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).send("No file uploaded.");
            return;
        }

        const filename = req.file.originalname;
        const uploadStream = gfs.openUploadStream(filename);
        const fileReadStream = fs.createReadStream(req.file.path);

        fileReadStream.pipe(uploadStream);

        uploadStream.on("error", (error) => {
            console.log(error);
            res.status(500).send("An error occurred during file upload.");
        });

        uploadStream.on("finish", () => {
            res.send("File uploaded successfully.");
        });

        // Remove the temporary file after upload
        fileReadStream.on("end", () => {
            fs.unlinkSync(req.file.path);
        });
    } catch (error) {
        console.log(error);
        res.status(500).send("An error occurred during file upload.");
    }
});

app.get("/file/:filename", async (req, res) => {
    try {
        const filename = decodeURIComponent(req.params.filename); // URL decode the filename
        const downloadStream = gfs.openDownloadStreamByName(filename);

        downloadStream.on("error", (error) => {
            console.log(error);
            res.status(404).send("File not found.");
        });

        res.set("Content-Type", "application/octet-stream");
        downloadStream.pipe(res);
    } catch (error) {
        console.log(error);
        res.status(500).send("An error occurred while retrieving the file.");
    }
});


// Remaining media routes...
// ...

const port = process.env.PORT || 8080;
app.listen(port, console.log(`Listening on port ${port}...`));

