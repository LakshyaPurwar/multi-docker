const keys = require('./keys');

// Express App Setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Postgres Client Setup
const { Pool } = require('pg');
const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort,
  ssl:
    process.env.NODE_ENV !== 'production'
      ? false
      : { rejectUnauthorized: false },
});

pgClient.on('connect', (client) => {
  client
    .query('CREATE TABLE IF NOT EXISTS values (number INT)')
    .catch((err) => console.error(err));
});

// Redis Client Setup
const redis = require('redis');
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000,
});
const redisPublisher = redisClient.duplicate();

// Express route handlers

app.get('/', (req, res) => {
  res.send('Hi');
});

app.get('/values/all', async (req, res) => {
  const values = await pgClient.query('SELECT * from values');

  res.send(values.rows);
});

app.get('/values/current', async (req, res) => {
  console.log("The request is surely coming here!")
  redisClient.hgetall('values', (err, values) => {
    console.log("Here in the values/current api");
    console.log("The values received from redis are = ",values)
    res.send(values);
  });
});

app.post('/values', async (req, res) => {
  const index = req.body.index;

  console.log("Index received = ",index);
  if (parseInt(index) > 40) {
    return res.status(422).send('Index too high');
  }
  console.log("Passed the if check succesfully!")
  redisClient.hset('values', index, 'Nothing yet!');
  console.log("Step 1 passed!")
  redisPublisher.publish('insert', index);
  console.log("Step 2 passed!")
  pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);
  console.log("Step 3 passed");
  res.send({ working: true });
  console.log('Returned successfully!')
});

app.listen(5000, (err) => {
  console.log('Listening');
});
