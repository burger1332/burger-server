const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, maxHttpBufferSize: 1e7 });

const USERS_FILE = path.join(__dirname, 'users.json');
const MSGS_FILE = path.join(__dirname, 'messages.json');

const getData = (file, def) => {
    try {
        if (!fs.existsSync(file)) return def;
        const data = fs.readFileSync(file, 'utf8');
        return data ? JSON.parse(data) : def;
    } catch (e) { return def; }
};
const setData = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

app.use(express.static(path.join(__dirname, '../client')));

const onlineUsers = {}; 

io.on('connection', (socket) => {
    let currentUser = null;

    socket.on('register', (data) => {
        let users = getData(USERS_FILE, {});
        if (users[data.login]) return socket.emit('auth_error', 'Логин занят');
        const newUser = { 
            password: data.password, 
            uid: Math.floor(10000 + Math.random() * 90000).toString(),
            friends: [], requests: [] 
        };
        users[data.login] = newUser;
        setData(USERS_FILE, users);
        socket.emit('auth_success', { login: data.login, ...newUser });
    });

    socket.on('login', (data) => {
        let users = getData(USERS_FILE, {});
        let user = users[data.login];
        if (user && user.password === data.password) {
            currentUser = data.login;
            onlineUsers[currentUser] = socket.id;
            socket.emit('auth_success', { login: currentUser, ...user });
        } else {
            socket.emit('auth_error', 'Неверный вход');
        }
    });

    socket.on('private_msg', (data) => {
        let msgs = getData(MSGS_FILE, []);
        let msg = { 
            from: currentUser, 
            to: data.to, 
            text: data.text || null, 
            type: data.type || 'text',
            media: data.media || null,
            time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) 
        };
        msgs.push(msg);
        setData(MSGS_FILE, msgs);
        if (onlineUsers[data.to]) io.to(onlineUsers[data.to]).emit('new_private_msg', msg);
        socket.emit('new_private_msg', msg);
    });

    socket.on('update_settings', (data) => {
        let users = getData(USERS_FILE, {});
        if (users[currentUser]) {
            if (data.password) users[currentUser].password = data.password;
            if (data.uid && !Object.values(users).some(u => u.uid === data.uid)) users[currentUser].uid = data.uid;
            setData(USERS_FILE, users);
            socket.emit('auth_success', { login: currentUser, ...users[currentUser] });
            socket.emit('settings_saved');
        }
    });

    socket.on('load_history', (data) => {
        let msgs = getData(MSGS_FILE, []);
        let history = msgs.filter(m => (m.from === data.me && m.to === data.with) || (m.from === data.with && m.to === data.me));
        socket.emit('history_loaded', history);
    });

    socket.on('search_user', (query) => {
        let users = getData(USERS_FILE, {});
        let found = Object.keys(users).find(n => n === query || users[n].uid === query);
        if (found) socket.emit('search_result', { login: found, uid: users[found].uid });
        else socket.emit('search_result', { error: 'Пользователь не найден' });
    });

    socket.on('send_request', (target) => {
        let users = getData(USERS_FILE, {});
        if (users[target] && target !== currentUser) {
            if (!users[target].requests.includes(currentUser) && !users[target].friends.includes(currentUser)) {
                users[target].requests.push(currentUser);
                setData(USERS_FILE, users);
                if (onlineUsers[target]) io.to(onlineUsers[target]).emit('update_profile', users[target]);
            }
        }
    });

    socket.on('accept_request', (sender) => {
        let users = getData(USERS_FILE, {});
        if (users[currentUser] && users[sender]) {
            users[currentUser].requests = users[currentUser].requests.filter(r => r !== sender);
            if (!users[currentUser].friends.includes(sender)) users[currentUser].friends.push(sender);
            if (!users[sender].friends.includes(currentUser)) users[sender].friends.push(currentUser);
            setData(USERS_FILE, users);
            socket.emit('auth_success', { login: currentUser, ...users[currentUser] });
            if (onlineUsers[sender]) io.to(onlineUsers[sender]).emit('auth_success', { login: sender, ...users[sender] });
        }
    });

    socket.on('disconnect', () => { if(currentUser) delete onlineUsers[currentUser]; });
});

server.listen(3000, '0.0.0.0', () => console.log('🚀 BURGEGRAM SERVER RUNNING ON PORT 3000'));