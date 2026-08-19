const mongoose = require('mongoose');

const eLibraryItemSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Resource title is required'],
            trim: true
        },
        author: {
            type: String,
            default: 'Department Faculty',
            trim: true
        },
        category: {
            type: String,
            required: [true, 'Category is required'],
            enum: [
                'Textbook',
                'Lecture Notes',
                'Thesis / Project',
                'Lab Manual',
                'Past Question Papers',
                'Research Paper',
                'Tutorial Sheet',
                'Other'
            ],
            default: 'Textbook'
        },
        yearLevel: {
            type: String,
            required: [true, 'Year level is required'],
            enum: [
                'All Years',
                '1st Year',
                '2nd Year',
                '3rd Year',
                '4th Year',
                '5th Year',
                '6th Year',
                'ME Program'
            ],
            default: 'All Years'
        },
        courseCode: {
            type: String,
            trim: true,
            uppercase: true,
            default: ''
        },
        courseName: {
            type: String,
            trim: true,
            default: ''
        },
        department: {
            type: String,
            default: 'Mechatronics Engineering',
            immutable: true, // Strictly Mechatronics-only
            trim: true
        },
        description: {
            type: String,
            trim: true,
            default: ''
        },
        originalFileName: {
            type: String,
            required: true,
            trim: true
        },
        storedFileName: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        storagePath: {
            type: String,
            required: true,
            trim: true
        },
        fileSize: {
            type: Number,
            required: true
        },
        fileType: {
            type: String,
            enum: ['pdf', 'epub', 'docx', 'pptx', 'zip'],
            required: true
        },
        coverImage: {
            type: String,
            default: ''
        },
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        uploadedByName: {
            type: String,
            required: true
        },
        uploadedByRole: {
            type: String,
            default: 'Teacher'
        },
        downloadsCount: {
            type: Number,
            default: 0
        },
        viewsCount: {
            type: Number,
            default: 0
        },
        isFeatured: {
            type: Boolean,
            default: false
        },
        tags: [{ type: String, trim: true }]
    },
    { timestamps: true }
);

// Search indexes
eLibraryItemSchema.index({ title: 'text', author: 'text', description: 'text', courseCode: 'text', tags: 'text' });
eLibraryItemSchema.index({ department: 1, category: 1, yearLevel: 1, createdAt: -1 });

module.exports = mongoose.model('ELibraryItem', eLibraryItemSchema);
