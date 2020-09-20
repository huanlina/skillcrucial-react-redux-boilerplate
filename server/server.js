import express from 'express'
import path from 'path'
import cors from 'cors'
import bodyParser from 'body-parser'
import sockjs from 'sockjs'
import { renderToStaticNodeStream } from 'react-dom/server'
import React from 'react'
import axios from 'axios'
import cookieParser from 'cookie-parser'
import config from './config'
import Html from '../client/html'

const { writeFile } = require("fs").promises

const Root = () => ''

try {
  // eslint-disable-next-line import/no-unresolved
  // ;(async () => {
  //   const items = await import('../dist/assets/js/root.bundle')
  //   console.log(JSON.stringify(items))

  //   Root = (props) => <items.Root {...props} />
  //   console.log(JSON.stringify(items.Root))
  // })()
  console.log(Root)
} catch (ex) {
  console.log(' run yarn build:prod to enable ssr')
}

let connections = []

const port = process.env.PORT || 8090
const server = express()

const setHeaders = (req, res, next) => {
  res.set('x-skillcrucial-user', '2b2268af-407f-4d42-af7f-f4f1d1eebe69')
  res.set('Access-Control-Expose-Headers', 'X-SKILLCRUCIAL-USER') 
  next()
}

const middleware = [
  cors(),
  express.static(path.resolve(__dirname, '../dist/assets')),
  bodyParser.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }),
  bodyParser.json({ limit: '50mb', extended: true }),
  cookieParser(),
  setHeaders
]
middleware.forEach((it) => server.use(it))

server.get('/api/v1/users/', async (req, res) => {  
  const users = await axios('https://jsonplaceholder.typicode.com/users').then(result => JSON.stringify(result.data))  
  writeFile(`${__dirname}/users.json`, users, { encoding: "utf8" })
  res.json(JSON.parse(users))  
})  

server.post('/api/v1/users',  (req, res) => {  
  res.json( { id: '', ...req.body })  
}) 

// server.get('/api/v1/users/take/:number', async (req, res) => {  
//   const { number } = req.params  
//   const { data: users } = await axios('https://jsonplaceholder.typicode.com/users')  
//   res.json(users.slice(0, +number))  
// })  

// server.get('/api/v1/users/:name', (req, res) => {  
//   const { name } = req.params  
//   res.json({ name })  
// })  

server.use('/api/', (req, res) => {
  res.status(404)
  res.end()
})

const [htmlStart, htmlEnd] = Html({
  body: 'separator',
  title: 'Skillcrucial - Become an IT HERO'
}).split('separator')

server.get('/', (req, res) => {
  const appStream = renderToStaticNodeStream(<Root location={req.url} context={{}} />)
  res.write(htmlStart)
  appStream.pipe(res, { end: false })
  appStream.on('end', () => {
    res.write(htmlEnd)
    res.end()
  })
})

server.get('/*', (req, res) => {
  const initialState = {
    location: req.url
  }

  return res.send(
    Html({
      body: '',
      initialState
    })
  )
})

const app = server.listen(port)

if (config.isSocketsEnabled) {
  const echo = sockjs.createServer()
  echo.on('connection', (conn) => {
    connections.push(conn)
    conn.on('data', async () => {})

    conn.on('close', () => {
      connections = connections.filter((c) => c.readyState !== 3)
    })
  })
  echo.installHandlers(app, { prefix: '/ws' })
}
console.log(`Serving at http://localhost:${port}`)
