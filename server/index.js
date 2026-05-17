import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import attendanceRouter from './routes/attendance.js'
import memberRouter from './routes/member.js'

dotenv.config({ path: '../.env' })

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.get('/ping', (req, res) => res.json({ ok: true }))

app.use('/api', attendanceRouter)
app.use('/api', memberRouter)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
