const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')

const app = express()

app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'https://hotel-booking-cf.netlify.app',
      'https://hotel-booking-server-rho.vercel.app',
    ],
    credentials: true,
  })
)

app.use((req, res, next) => {
  res.header(
    'Access-Control-Allow-Origin',
    'http://localhost:5173',
    'https://hotel-booking-cf.netlify.app'
  ) // Update with your actual client's origin
  res.header('Access-Control-Allow-Credentials', true)
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE')
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  )

  next()
})

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
    const reviewCollection = client
      .db('HotelBooking')
      .collection('HotelReviews')

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
          secure: true,
          sameSite: 'none',
          maxAge: 60 * 60 * 1000,
        })
        .send({ success: true })
    })

    app.post('/api/v1/logout', async (req, res) => {
      const user = req.body
      console.log('logging out', user)
      res
        .clearCookie('token', { maxAge: 0, secure: true, sameSite: 'none' })
        .send({ success: true })
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

    app.post('/api/v1/bookings', async (req, res) => {
      const booking = req.body

      const roomQuery = { _id: new ObjectId(booking.room_id) }
      const room = await roomCollection.findOne(roomQuery)

      if (room.availability > 0) {
        const alreadyBooked = await bookingCollection.findOne({
          room_id: booking.room_id,
          date: booking.date,
        })

        if (alreadyBooked) {
          res
            .status(400)
            .send({ message: 'Room is already booked for that time' })
        } else {
          const result = await bookingCollection.insertOne(booking)

          const updateDoc = {
            $inc: { availability: -1 },
          }
          await roomCollection.updateOne(roomQuery, updateDoc)

          res.send(result)
        }
      } else {
        res.status(400).send({ message: 'Room is not available' })
      }
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
      const bookingId = req.params.id
      const query = { _id: new ObjectId(bookingId) }

      const booking = await bookingCollection.findOne(query)

      if (!booking) {
        return res.status(404).send({ message: 'Booking not found' })
      }

      const roomId = booking.room_id

      const filter = { _id: new ObjectId(roomId) }
      const updateDoc = {
        $inc: { availability: 1 },
      }

      await roomCollection.updateOne(filter, updateDoc)

      const result = await bookingCollection.deleteOne(query)

      res.send(result)
    })

    // review comment related end points
    app.post('/api/v1/reviews', verifyToken, async (req, res) => {
      const review = req.body
      const result = await reviewCollection.insertOne(review)
      res.send(result)
    })

    app.get('/api/v1/reviews', async (req, res) => {
      const cursor = reviewCollection.find()
      const review = await cursor.toArray()
      res.send(review)
    })

    app.get('/api/v1/reviews/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await reviewCollection.findOne(query)
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
