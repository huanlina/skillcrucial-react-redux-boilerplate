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

const { writeFile, readFile, unlink } = require("fs").promises

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

function doesFileExist () {
  return readFile(`${__dirname}/users.json`)
    .then((file) => {
      return JSON.parse(file)
    }) 
    .catch( async () => {
      const users = await axios('https://jsonplaceholder.typicode.com/users')
        .then(result => result.data)
      writeFile(`${__dirname}/users.json`, JSON.stringify(users), { encoding: "utf8" })
      return users.sort((a, b) => a.id - b.id)
    })
}

function toWriteFile(fileData) {
  writeFile(`${__dirname}/users.json`, JSON.stringify(fileData), 'utf8' )
}

server.get('/api/v1/users/', async (req, res) => {  
  const result = await doesFileExist()
  res.json(result)  
})  

server.post('/api/v1/users', async (req, res) => {  
  const newUser = req.body
  const userData = await doesFileExist()
  newUser.id = (userData.length === 0) ? 1 : userData[userData.length - 1].id + 1
  toWriteFile([...userData, newUser])
  res.json({status: 'success', id: newUser.id})  
}) 

server.patch('/api/v1/users/:userId', async (req, res) => {  
  const { userId } = req.params
  const newUser = req.body
  const arr = await doesFileExist()
  const objId = arr.find((obj) => obj.id === +userId)
  const objId2 = { ...objId, ...newUser }
  const newArr = arr.map((obj) => obj.id === objId2.id ? objId2 : obj)
  toWriteFile(newArr)
  res.json({status: 'success', id: userId})  
}) 

server.delete('/api/v1/users/:userId', async (req, res) => {
  const { userId } = req.params
  const arr = await doesFileExist()
  const objId = arr.find((obj) => obj.id === +userId)
  const newArr = arr.filter((obj) => obj.id !== objId.id)
  toWriteFile(newArr)
  res.json({ status: 'success', id: userId })
})

server.delete('/api/v1/users', (req, res) => {
  unlink(`${__dirname}/users.json`)
    .then(() => res.json({ status: "success" }))
    .catch(() => res.send('no file'))
})

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
