const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Настройка путей к базе данных
const USERS_FILE = path.join(__dirname, 'users.json');
const MSG_FILE = path.join(__dirname, 'messages.json');

// Проверка наличия файлов базы данных (создаем пустые, если их нет)
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({}));
if (!fs.existsSync(MSG_FILE)) fs.writeFileSync(MSG_FILE, JSON.stringify([]));

// Раздаем статические файлы (твой index.html и картинки)
app.use(express.static(__dirname));

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Логика чата
io.on('connection', (socket) => {
    console.log('Пользователь подключен:', socket.id);

    // Авторизация
    socket.on('login', (data) => {
        const users = JSON.parse(fs.readFileSync(USERS_FILE));
        const user = users[data.login];
        if (user && user.password === data.password) {
            socket.join(data.login);
            socket.emit('auth_success', user);
        } else {
            socket.emit('auth_error', 'Неверный логин или пароль');
        }
    });

    // Регистрация
    socket.on('register', (data) => {
        const users = JSON.parse(fs.readFileSync(USERS_FILE));
        if (users[data.login]) {
            socket.emit('auth_error', 'Логин занят');
            return;
        }
        const newUser = {
            login: data.login,
            password: data.password,
            uid: Math.floor(10000 + Math.random() * 90000),
            friends: [],
            requests: []
        };
        users[data.login] = newUser;
        fs.writeFileSync(USERS_FILE, JSON.stringify(users));
        socket.join(data.login);
        socket.emit('auth_success', newUser);
    });

    // Личные сообщения
    socket.on('private_msg', (m) => {
        const messages = JSON.parse(fs.readFileSync(MSG_FILE));
        const newMsg = {
            from: m.from || socket.id, // В реальном чате тут логин отправителя
            to: m.to,
            text: m.text,
            type: m.type || 'text',
            media: m.media || null,
            time: new Date().toLocaleTimeString().slice(0, 5)
        };
        messages.push(newMsg);
        fs.writeFileSync(MSG_FILE, JSON.stringify(messages));
        
        // Отправляем обоим участникам
        io.to(m.to).emit('new_private_msg', newMsg);
        socket.emit('new_private_msg', newMsg);
    });

    socket.on('disconnect', () => {
        console.log('Пользователь отключился');
    });
});

// ВАЖНО: Render использует динамический порт
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Бургер-сервер запущен на порту ${PORT}`);
});
