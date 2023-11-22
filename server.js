const express = require('express');
const mongoose = require('mongoose');
const config = require('./config');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();
let cors = require("cors");
app.use(cors());
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect('mongodb+srv://MadhAsh19:JYfTzG9qd9sl60KO@url-shortener.yoavdsr.mongodb.net/')
    .then(() => {
        console.log('Connected to MongoDB');
    })
    .catch((error) => {
        console.error('Error connecting to MongoDB:', error.message);
    });


// Define URL Schema
const urlSchema = new mongoose.Schema({
    hashKey: String,
    longUrl: String,
    shortUrl: String,
});

const UrlModel = mongoose.model('Url', urlSchema);

// Middleware
app.use(bodyParser.json());

// Routes
app.post('/shorten', async (req, res) => {
    try {
        const { longUrl } = req.body;

        // Check to see if request is valid
        if (!longUrl) {
            throw new Error('400 Error - Bad Request: longUrl is required');
        }

        // Check if the URL already exists in the database
        const existingUrl = await UrlModel.findOne({ longUrl: longUrl });

        if (existingUrl) {
            console.log('Already Exists in db!')
            res.json({ shortUrl: existingUrl.shortUrl });
        } else {
            const genHashKey = generateUrlHashKey(longUrl);
            let shortUrl = `http://localhost:${PORT}/${genHashKey}`;

            // Handle collisions. Note genereateUrlHashKey() is idempotent
            let counter = 1;
            while (await UrlModel.findOne({ hashKey: genHashKey })) {
                counter++;
                genHashKey = generateUrlHashKey(longUrl + counter);
                shortUrl = `http://localhost:${PORT}/${genHashKey}`;
            }

            // Save the URL in the database
            const urlObj = new UrlModel({ hashKey: genHashKey, longUrl, shortUrl });
            await urlObj.save();

            res.json({ shortUrl: shortUrl });
        }
    } catch (error) {
        console.error(error);

        if (error.message.startsWith('400 Error')) {
            // Handle the specific bad request error
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'An Error Occurred!' });
        }
    }
});

app.get('/:hashKey', async (req, res) => {
    try {
        const { hashKey } = req.params;

        const url = await UrlModel.findOne({ hashKey });

        if (url) {
            res.redirect(url.longUrl);
            //res.json({ longUrl: url.longUrl });
        } else {
            res.status(404).json({ error: 'URL not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while retrieving the URL' });
    }
});

app.delete('/delete/:longUrl', async (req, res) => {
    try {
        const { longUrl } = req.params;

        const existingUrl = await UrlModel.findOne({ longUrl });

        if (!existingUrl) {
            res.status(404).json({ error: 'URL not found in the database' });
            return;
        }

        // Delete the URL from the database
        await UrlModel.deleteOne({ longUrl });

        res.json({ message: 'URL deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while deleting the URL' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

function generateUrlHashKey(longUrl) {
    const fullHash = crypto.createHash('sha256').update(longUrl).digest('hex');
    const shortHash = fullHash.substring(0, 8);
    return shortHash;
}