const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// Настройка Socket.io с поддержкой CORS
const io = new Server(server, {
    cors: {
        origin: "*", // Разрешаем подключаться всем
        methods: ["GET", "POST"]
    }
});

const USERS_FILE = path.join(__dirname, 'users.json');
const MSG_FILE = path.join(__dirname, 'messages.json');

if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({}));
if (!fs.existsSync(MSG_FILE)) fs.writeFileSync(MSG_FILE, JSON.stringify([]));

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ГЛАВНОЕ: Обработка событий чата
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('login', (data) => {
        const users = JSON.parse(fs.readFileSync(USERS_FILE));
        const user = users[data.login];
        if (user && user.password === data.password) {
            socket.join(data.login);
            socket.emit('auth_success', user);
        } else {
            socket.emit('auth_error', 'Ошибка входа');
        }
    });

    socket.on('register', (data) => {
        const users = JSON.parse(fs.readFileSync(USERS_FILE));
        if (users[data.login]) return socket.emit('auth_error', 'Логин занят');
        
        const newUser = { login: data.login, password: data.password, friends: [], requests: [] };
        users[data.login] = newUser;
        fs.writeFileSync(USERS_FILE, JSON.stringify(users));
        socket.join(data.login);
        socket.emit('auth_success', newUser);
    });

    socket.on('private_msg', (m) => {
        const messages = JSON.parse(fs.readFileSync(MSG_FILE));
        const newMsg = { from: m.from, to: m.to, text: m.text, time: new Date().toLocaleTimeString() };
        messages.push(newMsg);
        fs.writeFileSync(MSG_FILE, JSON.stringify(messages));

        // Отправка сообщения
        io.to(m.to).emit('new_private_msg', newMsg);
        socket.emit('new_private_msg', newMsg);
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log('Server is running!'));
