require('dotenv').config();
const express = require('express');
const path = require('path');
const chatRoutes = require('./routes/chat');
const learningRoutes = require('./routes/learning');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/chat', chatRoutes);
app.use('/api/learning', learningRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Alter Ego server running on http://localhost:${PORT}`);
});
