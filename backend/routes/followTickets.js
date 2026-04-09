const express = require('express');
const UserFollowTicket = require('../models/UserFollowTickets');

const router = express.Router();

router.get("/all/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).json({ message: 'Faltan campos obligatorios' });
        }

        const userFollowTickets = await UserFollowTicket.find({ userId, unfollowAt: null });

        res.json(userFollowTickets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})

router.get("/check/:userId/:ticketId", async (req, res) => {
    try {
        const { userId, ticketId } = req.params;
        if (!userId || !ticketId) {
            return res.status(400).json({ message: 'Faltan campos obligatorios' });
        }

        const userFollowTicket = await UserFollowTicket.findOne({ userId, ticketId, unfollowAt: null });

        res.json({ isFollowing: !!userFollowTicket });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})

router.post("/follow", async (req, res) => {
    try {
        const { userId, ticketId } = req.body;
        if (!userId || !ticketId) {
            res.status(400).json({ message: 'Faltan campos obligatorios' });
        }

        const previousFollow = await UserFollowTicket.findOne({ userId, ticketId });
        if (previousFollow) {
            previousFollow.unfollowAt = null;
            await previousFollow.save();
            return res.json(previousFollow);
        }

        const userFollowTicket = await UserFollowTicket.create({ userId, ticketId });

        res.json(userFollowTicket);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})

router.put("/unfollow", async (req, res) => {
    try {
        const { userId, ticketId } = req.body;
        if (!userId || !ticketId) {
            res.status(400).json({ message: 'Faltan campos obligatorios' });
        }

        const userFollowTicket = await UserFollowTicket.updateOne({ userId, ticketId }, { unfollowAt: new Date() });

        res.json(userFollowTicket);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})

module.exports = router;