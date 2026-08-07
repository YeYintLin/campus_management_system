const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
    {
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Sender is required'],
        },
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Recipient is required'],
        },
        content: {
            type: String,
            required: [true, 'Message content is required'],
            trim: true,
            maxlength: 2000,
        },
        read: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

// Indexes for conversation history queries & unread count performance
messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, read: 1 });

module.exports = mongoose.model('Message', messageSchema);
