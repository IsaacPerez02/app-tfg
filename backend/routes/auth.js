const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');

const router = express.Router();

/**
 * REGISTER
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Faltan campos obligatorios' });
        }

        const userExists = await User.findOne({
            $or: [{ email }, { name }]
        });

        if (userExists) {
            return res.status(400).json({ message: 'Usuario o email ya existe' });
        }

        const user = await User.create({
            name,
            email,
            password
        });
        await user.save();

        res.status(201).json({
            message: 'Usuario registrado correctamente',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: error.message });
    }
});

/**
 * LOGIN
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email y password requeridos' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Credenciales inválidas' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Credenciales inválidas' });
        }

        res.json({
            message: 'Login exitoso',
            userId: user.id,
            role: user.role
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;