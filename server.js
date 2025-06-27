const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');

const app = express();

app.use(
    cors({
        origin: "http://localhost:5173",
        credentials: true,             
    })
  );
app.use(express.json());

const PORT = process.env.PORT || 5001;

app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
    res.send('Server is running!');
});

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});