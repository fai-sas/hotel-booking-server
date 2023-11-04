const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
require('dotenv').config()
const express = require('express')
const cors = require('cors')

const app = express()

app.use(cors())
app.use(express.json())

const port = process.env.PORT || 5000

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@node-express.sczsc.mongodb.net/?retryWrites=true&w=majority`

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect()

    const hotelBookingCollection = client
      .db('HotelBooking')
      .collection('HotelRooms')

    app.post('/api/v1/create-rooms', async (req, res) => {
      const newRoom = req.body
      const result = await hotelBookingCollection.insertOne(newRoom)
      res.send(result)
    })

    app.get('/api/v1/get-rooms', async (req, res) => {
      const cursor = hotelBookingCollection.find()
      const result = await cursor.toArray()
      console.log(result)
      res.send(result)
    })

    app.get('/api/v1/get-rooms/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await hotelBookingCollection.findOne(query)
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
