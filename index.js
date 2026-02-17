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

// Проверка наличия файлов базы данных
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({}));
if (!fs.existsSync(MSG_FILE)) fs.writeFileSync(MSG_FILE, JSON.stringify([]));

// --- ИСПРАВЛЕННЫЙ БЛОК ЗАПУСКА (тот, что сработал) ---
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    const htmlPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(htmlPath)) {
        res.sendFile(htmlPath);
    } else {
        res.status(404).send("Ошибка: index.html не найден в корне проекта!");
    }
});
// ----------------------------------------------------

// Логика чата (Socket.io)
io.on('connection', (socket) => {
    console.log('Пользователь подключен:', socket.id);

    // Вход (Login)
    socket.on('login', (data) => {
        try {
            const users = JSON.parse(fs.readFileSync(USERS_FILE));
            const user = users[data.login];
            if (user && user.password === data.password) {
                socket.join(data.login);
                socket.emit('auth_success', user);
                console.log(`Успешный вход: ${data.login}`);
            } else {
                socket.emit('auth_error', 'Неверный логин или пароль');
            }
        } catch (e) { console.error(e); }
    });

    // Регистрация (Register)
    socket.on('register', (data) => {
        try {
            const users = JSON.parse(fs.readFileSync(USERS_FILE));
            if (users[data.login]) {
                socket.emit('auth_error', 'Логин уже занят');
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
            console.log(`Новый юзер: ${data.login}`);
        } catch (e) { console.error(e); }
    });

    // Личные сообщения (Private Messages)
    socket.on('private_msg', (m) => {
        try {
            const messages = JSON.parse(fs.readFileSync(MSG_FILE));
            const newMsg = {
                from: m.from,
                to: m.to,
                text: m.text,
                type: m.type || 'text',
                time: new Date().toLocaleTimeString().slice(0, 5)
            };
            messages.push(newMsg);
            fs.writeFileSync(MSG_FILE, JSON.stringify(messages));
            
            // Отправляем получателю и отправителю
            io.to(m.to).emit('new_private_msg', newMsg);
            socket.emit('new_private_msg', newMsg);
        } catch (e) { console.error(e); }
    });

    socket.on('disconnect', () => {
        console.log('Пользователь отключился');
    });
});

// Динамический порт для Render
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
