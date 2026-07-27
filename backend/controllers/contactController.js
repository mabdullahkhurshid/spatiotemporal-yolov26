const Contact = require('../models/Contact');
const { sendContactNotificationEmail } = require('../services/emailService');

// @desc    Submit contact form (public)
// @route   POST /api/public/contact
// @access  Public
exports.submitContact = async (req, res, next) => {
  try {
    const { name, email, subject, message, organization } = req.body;

    const contact = await Contact.create({
      name,
      email,
      subject: subject || 'General inquiry',
      message,
      organization,
    });

    try {
      await sendContactNotificationEmail(contact);
    } catch (emailError) {
      console.error('Contact email failed (message saved):', emailError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Your message has been sent successfully.',
      data: { id: contact._id },
    });
  } catch (error) {
    next(error);
  }
};
