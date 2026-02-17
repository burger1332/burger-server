const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// Настройка Socket.io с разрешением CORS для работы в сети
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Пути к файлам базы данных
const USERS_FILE = path.join(__dirname, 'users.json');
const MSG_FILE = path.join(__dirname, 'messages.json');

// Создаем файлы базы, если их еще нет на сервере
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({}));
if (!fs.existsSync(MSG_FILE)) fs.writeFileSync(MSG_FILE, JSON.stringify([]));

// 1. Раздаем статические файлы (HTML, CSS, JS, картинки) прямо из корня
app.use(express.static(path.join(__dirname)));

// 2. Главный маршрут, который открывает твой интерфейс
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 3. Тестовый маршрут, чтобы проверить жив ли сервер
app.get('/ping', (req, res) => {
    res.send('Бургер-сервер работает!');
});

// Логика мессенджера
io.on('connection', (socket) => {
    console.log('Подключен пользователь:', socket.id);

    // Вход
    socket.on('login', (data) => {
        try {
            const users = JSON.parse(fs.readFileSync(USERS_FILE));
            const user = users[data.login];
            if (user && user.password === data.password) {
                socket.join(data.login);
                socket.emit('auth_success', user);
            } else {
                socket.emit('auth_error', 'Неверный логин или пароль');
            }
        } catch (e) {
            console.log('Ошибка логина:', e);
        }
    });

    // Регистрация
    socket.on('register', (data) => {
        try {
            const users = JSON.parse(fs.readFileSync(USERS_FILE));
            if (users[data.login]) {
                socket.emit('auth_error', 'Этот ник уже занят');
                return;
            }
            const newUser = {
                login: data.login,
                password: data.password,
                uid: Math.floor(1000 + Math.random() * 9000),
                friends: [],
                requests: []
            };
            users[data.login] = newUser;
            fs.writeFileSync(USERS_FILE, JSON.stringify(users));
            socket.join(data.login);
            socket.emit('auth_success', newUser);
        } catch (e) {
            console.log('Ошибка регистрации:', e);
        }
    });

    // Сообщения
    socket.on('private_msg', (m) => {
        try {
            const messages = JSON.parse(fs.readFileSync(MSG_FILE));
            const newMsg = {
                from: m.from,
                to: m.to,
                text: m.text,
                time: new Date().toLocaleTimeString().slice(0, 5)
            };
            messages.push(newMsg);
            fs.writeFileSync(MSG_FILE, JSON.stringify(messages));
            
            io.to(m.to).emit('new_private_msg', newMsg);
            socket.emit('new_private_msg', newMsg);
        } catch (e) {
            console.log('Ошибка сообщения:', e);
        }
    });

    socket.on('disconnect', () => {
        console.log('Пользователь ушел');
    });
});

// Используем порт от Render (динамический) или 10000 локально
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`=== BURGEGRAM запущен на порту ${PORT} ===`);
});
