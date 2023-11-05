const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')

const app = express()

app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
  })
)

app.use(express.json())
app.use(cookieParser())

const port = process.env.PORT || 5000

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@node-express.sczsc.mongodb.net/?retryWrites=true&w=majority`

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
    next()
  })
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect()

    const roomCollection = client.db('HotelBooking').collection('HotelRooms')
    const userCollection = client.db('HotelBooking').collection('HotelUsers')
    const bookingCollection = client
      .db('HotelBooking')
      .collection('RoomBookings')

    // auth related endpoints
    app.post('/api/v1/jwt', async (req, res) => {
      const user = req.body
      console.log(user)

      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1h',
      })

      res
        .cookie('token', token, {
          httpOnly: true,
          secure: false,
          // sameSite: 'none'
        })
        .send({ success: true })
    })

    app.post('/api/v1/logout', async (req, res) => {
      const user = req.body
      console.log('logging out', user)
      res.clearCookie('token', { maxAge: 0 }).send({ success: true })
    })

    // rooms related endpoints
    app.post('/api/v1/create-rooms', async (req, res) => {
      const newRoom = req.body
      const result = await roomCollection.insertOne(newRoom)
      res.send(result)
    })

    app.get('/api/v1/get-rooms', async (req, res) => {
      let sortObject = {}
      const sortField = req.query.sortField
      const sortOrder = req.query.sortOrder

      if (sortField) {
        sortObject[sortField] = sortOrder
      }

      const cursor = roomCollection.find().sort(sortObject)
      const result = await cursor.toArray()
      res.send(result)
    })

    app.get('/api/v1/get-rooms/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await roomCollection.findOne(query)
      res.send(result)
    })

    // user related endpoints

    app.post('/api/v1/create-user', async (req, res) => {
      const user = req.body
      const result = await userCollection.insertOne(user)
      res.send(result)
    })

    app.get('/api/v1/get-users', async (req, res) => {
      const cursor = userCollection.find()
      const users = await cursor.toArray()
      res.send(users)
    })

    // booking related endpoints
    app.post('/api/v1/bookings', async (req, res) => {
      const booking = req.body
      const result = await bookingCollection.insertOne(booking)
      res.send(result)
    })

    app.get('/api/v1/bookings', verifyToken, async (req, res) => {
      let query = {}
      if (req.query?.email) {
        query = { email: req.query.email }
      }
      const result = await bookingCollection.find(query).toArray()
      res.send(result)
    })

    app.get('/api/v1/bookings/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await bookingCollection.findOne(query)
      res.send(result)
    })

    app.patch('/api/v1/bookings/:id', async (req, res) => {
      const id = req.params.id
      const filter = { _id: new ObjectId(id) }

      const updatedBooking = req.body

      const updateDoc = {
        $set: {
          ...updatedBooking,
        },
      }
      const result = await bookingCollection.updateOne(filter, updateDoc)
      res.send(result)
    })

    app.delete('/api/v1/delete-booking/:id', verifyToken, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await bookingCollection.deleteOne(query)
      res.send(result)
    })

    //  Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close()
  }
}
run().catch(console.dir)

app.get('/api/v1', (req, res) => {
  res.send('hotel booking app is running...')
})

app.listen(port, () => {
  console.log(`hotel booking app is listening to port ${port}`)
})
