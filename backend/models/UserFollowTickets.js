const mongoose = require('mongoose');

const UserFollowTicketSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    ticketId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ticket',
        required: true
    },
    unfollowAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('UserFollowTicket', UserFollowTicketSchema);    