require('dotenv').config({ path: '.env' });

const express = require('express');
const mediaRoutes = require('./routes/mediaRoutes');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors());

// Serve static files
app.use('/uploads', express.static('uploads'));
app.use('/outputs', express.static('outputs'));
app.use('/thumbnails', express.static('thumbnails'));
app.use('/temp', express.static('temp'));

app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.use('/api/media', mediaRoutes);
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/mail', require('./routes/mailRoutes'));

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});