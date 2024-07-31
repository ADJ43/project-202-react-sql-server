require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise'); // Using the promise API for async/await
const bodyParser = require('body-parser');
const cors = require('cors');


const app = express();
const PORT = process.env.SERVER_PORT;

app.use(bodyParser.json());
// Allow requests from http://localhost:3001
app.use(cors({
  origin: 'http://localhost:3001'
}));

// Database connection
const dbConfig = {
  host: process.env.HOST,
  port: process.env.PORT,
  user: process.env.USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE
};


// Function to call the stored procedure GetTechnologiesLength
async function getTechnologiesLength() {
    const connection = await mysql.createConnection(dbConfig);
    try {
      await connection.query('CALL GetTechnologiesLength(@tech_length);');
      const [rows] = await connection.query('SELECT @tech_length AS tech_length;');
      return rows[0];
    } finally {
      await connection.end();
    }
  }

// Function to get the requested technology image if it exists
async function getTechnologyImage(number) {
  const connection = await mysql.createConnection(dbConfig);
  try {
      const [rows] = await connection.query('CALL GetTechnologyImage(?, @tech_image);', [number]);
      console.log(rows);
      const [[ result ]] = await connection.query('SELECT @tech_image AS tech_image');
      console.log(result);

      if (result.tech_image === null) {
        throw new Error('Technology not found');
    }

      // Return the image URL
      return result.tech_image;
  } finally {
      await connection.end();
  }
}

// Function to Guess and get the technology result, UPDATE the score for that user. If user not passed in POST call, then user = guess by default.
async function postGuessAndUpdateScore(techIndex, guessedName, playerName = 'guess') {
  const connection = await mysql.createConnection(dbConfig);

  if (techIndex === undefined || null) techIndex = null;
  if (guessedName === undefined || null) guessedName = '';
  if (playerName === undefined || null) playerName = 'guest';

  try {
    const [rows] = await connection.query('CALL CheckGuessAndUpdateScore(?, ?, ?, @is_correct, @tech_name);', [techIndex, guessedName, playerName]);
    console.log(rows);
    const [[ result ]] = await connection.query('SELECT @is_correct AS is_correct, @tech_name AS tech_name;');
    console.log(result);
    return result;

  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  } finally {
    await connection.end();
  }
}

async function getScores(playerName) {
  const connection = await mysql.createConnection(dbConfig);
  try {
    const [rows] = await connection.query('CALL getScores(?, @player_scores);', [playerName]);
    const [[result]] = await connection.query('SELECT @player_scores AS player_scores');
    const parsedResult = JSON.parse(result.player_scores);
    return parsedResult;
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }finally {
    await connection.end();
  }

}

// Endpoint to POST the GUESS and get the Tech_Name, Update SCORE.
app.post('/api/guess', async (req, res) => {
  const { techIndex, guessedName, playerName = 'guest' } = req.body;
  
  console.log(`Request body: techIndex=${techIndex}, guessedName=${guessedName}, playerName=${playerName}`);

  // Validate that techIndex and guessedName are provided
  if (techIndex === undefined || guessedName === undefined) {
    return res.status(400).send('Missing required parameters: techIndex and guessedName');
  }

  // Reject the request if parameters are not passed.
  if (!Number.isInteger(techIndex) || techIndex < 0) {
    return res.status(400).send('Missing required or wrong parameters');
  }

  try {
    const result = await postGuessAndUpdateScore(techIndex, guessedName, playerName);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error 123');
  }
});

// Endpoint to retrieve the requested technology image
app.get('/api/technologies/image/:number', async (req, res) => {
  const { number } = req.params
    try {
      const result = await getTechnologyImage(number);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
    }
});

// Endpoint to retrieve the number of technologies
app.get('/api/technologies/count', async (req, res) => {
    try {
      const result = await getTechnologiesLength();
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
    }
  });

  app.get('/api/getScores/:playerName?', async (req, res) => {
    let { playerName } = req.params;
  
    if (!playerName) {
      playerName = 'all';  // Default to 'all' if no player name is provided
    }
    console.log('player name', playerName)
    try {
      const result = await getScores(playerName);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).send('Server error')
    }
  })


  // Function to test the database connection.
async function testDatabaseConnection() {
    try {
      const connection = await mysql.createConnection(dbConfig);
      console.log('Database connected successfully!');
      await connection.end();
    } catch (error) {
      console.error('Database connection failed:', error);
    }
  }
  

// Start the server
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await testDatabaseConnection();
});
