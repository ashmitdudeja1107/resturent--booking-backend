const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');

function emitSocketEvent(req, eventName, data, room = null) {
  const io = req.app.get('io');
  if (io) {
    if (room) {
      io.to(room).emit(eventName, data);
    } else {
      io.emit(eventName, data);
    }
    console.log(`📡 Socket event emitted: ${eventName}${room ? ` to room: ${room}` : ''}`);
  }
}

const numberWords = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4,
    'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
    'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13,
    'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17,
    'eighteen': 18, 'nineteen': 19, 'twenty': 20
};

function extractBookingInfo(text) {
    const info = {};
    const lowerText = text.toLowerCase();
    
    console.log('🔍 Extracting from text:', text);
    
    const digitGuestMatch = lowerText.match(/(\d+)\s*(people|person|guests?|pax|diners?)/i);
    if (digitGuestMatch) {
        info.numberOfGuests = parseInt(digitGuestMatch[1]);
    }
    else {
        const spokenGuestMatch = lowerText.match(/(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s*(people|person|guests?|pax|diners?)/i);
        if (spokenGuestMatch) {
            info.numberOfGuests = numberWords[spokenGuestMatch[1]];
        }
    }
    
    if (!info.numberOfGuests) {
        const tableForMatch = lowerText.match(/table\s+for\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i);
        if (tableForMatch) {
            const num = tableForMatch[1];
            info.numberOfGuests = isNaN(num) ? numberWords[num] : parseInt(num);
        }
    }
    
    if (!info.numberOfGuests) {
        const partyMatch = lowerText.match(/party\s+of\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i);
        if (partyMatch) {
            const num = partyMatch[1];
            info.numberOfGuests = isNaN(num) ? numberWords[num] : parseInt(num);
        }
    }
    
    const cuisines = {
        'italian': 'Italian',
        'chinese': 'Chinese',
        'indian': 'Indian',
        'mexican': 'Mexican',
        'japanese': 'Japanese',
        'sushi': 'Japanese',
        'american': 'American',
        'thai': 'Thai',
        'french': 'French',
        'mediterranean': 'Mediterranean',
        'pizza': 'Italian',
        'pasta': 'Italian',
        'curry': 'Indian',
        'ramen': 'Japanese',
        'tacos': 'Mexican'
    };
    
    for (const [keyword, cuisine] of Object.entries(cuisines)) {
        if (lowerText.includes(keyword)) {
            info.cuisinePreference = cuisine;
            break;
        }
    }
    
    if (lowerText.match(/\btoday\b/i)) {
        info.dateText = 'today';
        info.parsedDate = new Date();
        console.log('✅ Matched: today');
    }
    else if (lowerText.match(/\btomorrow\b/i)) {
        info.dateText = 'tomorrow';
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        info.parsedDate = tomorrow;
        console.log('✅ Matched: tomorrow');
    }
    else if (lowerText.match(/day\s+after\s+tomorrow/i)) {
        info.dateText = 'day after tomorrow';
        const dayAfter = new Date();
        dayAfter.setDate(dayAfter.getDate() + 2);
        info.parsedDate = dayAfter;
        console.log('✅ Matched: day after tomorrow');
    }
    else {
        const dayOfWeekMatch = lowerText.match(/(this|next)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
        if (dayOfWeekMatch) {
            info.dateText = dayOfWeekMatch[0];
            const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const targetDay = daysOfWeek.indexOf(dayOfWeekMatch[2].toLowerCase());
            const today = new Date();
            const currentDay = today.getDay();
            let daysUntilTarget = targetDay - currentDay;
            
            if (dayOfWeekMatch[1] === 'next' || daysUntilTarget <= 0) {
                daysUntilTarget += 7;
            }
            
            const targetDate = new Date();
            targetDate.setDate(today.getDate() + daysUntilTarget);
            info.parsedDate = targetDate;
            console.log('✅ Matched day of week:', info.dateText);
        }
    }
    
    if (!info.parsedDate) {
        let dateMatch = lowerText.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(\d{4}))?/i);
        
        if (dateMatch) {
            info.dateText = dateMatch[0];
            const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
            const day = parseInt(dateMatch[1]);
            const month = months.indexOf(dateMatch[2].toLowerCase());
            const year = dateMatch[3] ? parseInt(dateMatch[3]) : new Date().getFullYear();
            
            info.parsedDate = new Date(year, month, day);
            console.log('✅ Matched specific date (DD Month YYYY):', info.dateText, '→', info.parsedDate);
        }
    }
    
    if (!info.parsedDate) {
        let dateMatch = lowerText.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?/i);
        
        if (dateMatch) {
            info.dateText = dateMatch[0];
            const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
            const month = months.indexOf(dateMatch[1].toLowerCase());
            const day = parseInt(dateMatch[2]);
            const year = dateMatch[3] ? parseInt(dateMatch[3]) : new Date().getFullYear();
            
            info.parsedDate = new Date(year, month, day);
            console.log('✅ Matched specific date (Month DD YYYY):', info.dateText, '→', info.parsedDate);
        }
    }
    
    if (!info.parsedDate) {
        const numericDateMatch = lowerText.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
        if (numericDateMatch) {
            info.dateText = numericDateMatch[0];
            const month = parseInt(numericDateMatch[1]) - 1;
            const day = parseInt(numericDateMatch[2]);
            const year = numericDateMatch[3] ? 
                (numericDateMatch[3].length === 2 ? 2000 + parseInt(numericDateMatch[3]) : parseInt(numericDateMatch[3])) 
                : new Date().getFullYear();
            info.parsedDate = new Date(year, month, day);
            console.log('✅ Matched numeric date:', info.dateText, '→', info.parsedDate);
        }
    }
    
    const time12Match = lowerText.match(/(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/i);
    if (time12Match) {
        let hour = time12Match[1];
        hour = isNaN(hour) ? numberWords[hour.toLowerCase()] : parseInt(hour);
        const minute = time12Match[2] || '00';
        const period = time12Match[3].toLowerCase().replace(/\./g, '');
        
        if (period === 'pm' && hour !== 12) hour += 12;
        if (period === 'am' && hour === 12) hour = 0;
        
        info.timeText = `${hour}:${minute}`;
        console.log('✅ Matched time (12-hour):', info.timeText);
    }
    else {
        const time24Match = lowerText.match(/(\d{1,2}):(\d{2})/);
        if (time24Match) {
            info.timeText = time24Match[0];
            console.log('✅ Matched time (24-hour):', info.timeText);
        }
    }
    
    if (!info.timeText) {
        if (lowerText.match(/\bnoon\b/i)) {
            info.timeText = '12:00';
        } else if (lowerText.match(/\bmidnight\b/i)) {
            info.timeText = '00:00';
        } else if (lowerText.match(/\bevening\b/i)) {
            info.timeText = '19:00';
        } else if (lowerText.match(/\bmorning\b/i)) {
            info.timeText = '09:00';
        } else if (lowerText.match(/\bafternoon\b/i)) {
            info.timeText = '14:00';
        } else if (lowerText.match(/\blunch\s*time\b/i)) {
            info.timeText = '12:30';
        } else if (lowerText.match(/\bdinner\s*time\b/i)) {
            info.timeText = '19:30';
        }
    }
    
    const specialKeywords = [
        'birthday', 'anniversary', 'celebration', 'vegetarian', 
        'vegan', 'gluten-free', 'gluten free', 'allergic', 'allergy',
        'wheelchair', 'accessible', 'quiet', 'window', 'view'
    ];
    
    info.specialRequests = [];
    for (const keyword of specialKeywords) {
        if (lowerText.includes(keyword)) {
            info.specialRequests.push(keyword);
        }
    }
    
    const nameMatch = lowerText.match(/(?:my name is|i'm|i am|this is|call me)\s+([a-z]+(?:\s+[a-z]+)?)/i);
    if (nameMatch) {
        info.customerName = nameMatch[1].split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    
    console.log('📊 Extracted info:', info);
    return info;
}

const conversationSessions = new Map();

function generateResponse(intent, context = {}) {
    const responses = {
        greeting: [
            "Hello! Welcome to our restaurant. I'd be happy to help you book a table. How many guests will be dining with us?",
            "Hi there! Thanks for choosing our restaurant. Let me help you with your reservation. How many people will be joining you?"
        ],
        confirm_guests: [
            `Perfect! A table for ${context.guests}. What date would you like to book?`,
            `Great! ${context.guests} guests noted. When would you like to dine with us?`
        ],
        confirm_date: [
            `Excellent! ${context.date} is noted. What time would you prefer?`,
            `Perfect! I have ${context.date} marked down. What time should I reserve for you?`
        ],
        confirm_time: [
            `${context.time} sounds good! Do you have any cuisine preference?`,
            `Perfect timing at ${context.time}! What type of cuisine would you like?`
        ],
        weather_suggestion: [
            context.weatherMessage || "Let me check the weather for your booking date..."
        ],
        confirm_booking: [
            `Perfect! Let me confirm:\n• ${context.guests} guests\n• ${context.date} at ${context.time}\n• ${context.cuisine} cuisine\n${context.weather || ''}\n\nCould you provide your name to complete the reservation?`
        ],
        final_confirmation: [
            `Excellent! Your booking is confirmed, ${context.name}! Booking ID: ${context.bookingId}. We look forward to seeing you on ${context.date} at ${context.time}. Is there anything else I can help you with?`
        ],
        fallback: [
            "I'm sorry, I didn't quite catch that. Could you please repeat?",
            "Could you clarify that for me?"
        ]
    };
    
    const responseList = responses[intent] || responses.fallback;
    return responseList[Math.floor(Math.random() * responseList.length)];
}

router.post('/process', async (req, res) => {
    try {
        const { text, sessionId = 'default' } = req.body;
        
        if (!text) {
            return res.status(400).json({ 
                success: false, 
                error: 'Text input is required' 
            });
        }
        
        console.log('💬 Processing text:', text);
        
        emitSocketEvent(req, 'agent-processing', {
            sessionId,
            status: 'processing',
            message: 'Agent is processing your request...',
            timestamp: new Date()
        }, sessionId);
        
        if (!conversationSessions.has(sessionId)) {
            conversationSessions.set(sessionId, {
                step: 'greeting',
                data: {},
                history: []
            });
        }
        
        const session = conversationSessions.get(sessionId);
        session.history.push({ role: 'user', text });
        
        const extractedInfo = extractBookingInfo(text);
        
        emitSocketEvent(req, 'info-extracted', {
            sessionId,
            extractedInfo,
            timestamp: new Date()
        }, sessionId);
        
        Object.assign(session.data, extractedInfo);
        
        let response = '';
        let nextStep = session.step;
        let requiresAction = null;
        
        switch (session.step) {
            case 'greeting':
                if (extractedInfo.numberOfGuests) {
                    response = generateResponse('confirm_guests', { guests: extractedInfo.numberOfGuests });
                    nextStep = 'awaiting_date';
                } else {
                    response = generateResponse('greeting');
                    nextStep = 'awaiting_guests';
                }
                break;
                
            case 'awaiting_guests':
                if (session.data.numberOfGuests) {
                    response = generateResponse('confirm_guests', { guests: session.data.numberOfGuests });
                    nextStep = 'awaiting_date';
                } else {
                    response = "I need to know how many guests will be dining. How many people?";
                }
                break;
                
            case 'awaiting_date':
                if (session.data.dateText && session.data.parsedDate) {
                    response = generateResponse('confirm_date', { date: session.data.dateText });
                    nextStep = 'awaiting_time';
                    requiresAction = 'fetch_weather';
                } else {
                    response = "What date would you like to book? You can say 'today', 'tomorrow', or a specific date like '10 December'.";
                }
                break;
                
            case 'awaiting_time':
                if (session.data.timeText) {
                    response = generateResponse('confirm_time', { time: session.data.timeText });
                    nextStep = 'awaiting_cuisine';
                } else {
                    response = "What time would you prefer? For example, '7 PM' or '19:00'.";
                }
                break;
                
            case 'awaiting_cuisine':
                if (session.data.cuisinePreference) {
                    response = `Excellent choice! ${session.data.cuisinePreference} cuisine it is. Any special requests?`;
                    nextStep = 'awaiting_special_requests';
                } else {
                    response = "What type of cuisine would you prefer? We offer Italian, Chinese, Indian, Mexican, and more.";
                }
                break;
                
            case 'awaiting_special_requests':
                if (text.toLowerCase().includes('no') || text.toLowerCase().includes('proceed')) {
                    response = generateResponse('confirm_booking', {
                        guests: session.data.numberOfGuests,
                        date: session.data.dateText,
                        time: session.data.timeText,
                        cuisine: session.data.cuisinePreference || 'Any'
                    });
                    nextStep = 'awaiting_name';
                } else if (extractedInfo.specialRequests && extractedInfo.specialRequests.length > 0) {
                    session.data.specialRequests = extractedInfo.specialRequests.join(', ');
                    response = "Noted! Any other special requirements, or should I proceed with the booking?";
                } else {
                    session.data.specialRequests = text;
                    response = "Got it! Any other requirements, or shall I proceed?";
                }
                break;
                
            case 'awaiting_name':
                session.data.customerName = extractedInfo.customerName || text.trim();
                requiresAction = 'create_booking';
                break;
        }
        
        session.step = nextStep;
        session.history.push({ role: 'agent', text: response });
        
        emitSocketEvent(req, 'agent-response', {
            sessionId,
            response,
            nextStep,
            sessionData: session.data,
            timestamp: new Date()
        }, sessionId);
        
        emitSocketEvent(req, 'conversation-update', {
            sessionId,
            step: nextStep,
            data: session.data,
            timestamp: new Date()
        }, sessionId);
        
        res.json({
            success: true,
            data: {
                response,
                sessionData: session.data,
                nextStep,
                requiresAction,
                extractedInfo
            }
        });
        
    } catch (error) {
        console.error('Agent Processing Error:', error);
        
        emitSocketEvent(req, 'agent-error', {
            sessionId: req.body.sessionId,
            error: error.message,
            timestamp: new Date()
        }, req.body.sessionId);
        
        res.status(500).json({ 
            success: false, 
            error: 'Failed to process conversation',
            message: error.message 
        });
    }
});

router.post('/update-preference', async (req, res) => {
    try {
        const { sessionId, seatingPreference } = req.body;
        
        if (!sessionId || !seatingPreference) {
            return res.status(400).json({ 
                success: false, 
                error: 'Session ID and seating preference are required' 
            });
        }
        
        if (!conversationSessions.has(sessionId)) {
            conversationSessions.set(sessionId, {
                step: 'greeting',
                data: {},
                history: []
            });
        }
        
        const session = conversationSessions.get(sessionId);
        
        session.data.seatingPreference = seatingPreference;
        
        console.log(`✅ Seating preference updated for session ${sessionId}: ${seatingPreference}`);
        
        emitSocketEvent(req, 'preference-updated', {
            sessionId,
            seatingPreference,
            message: `Seating preference set to: ${seatingPreference}`,
            timestamp: new Date()
        }, sessionId);
        
        res.json({
            success: true,
            data: {
                message: 'Seating preference updated successfully',
                seatingPreference,
                sessionData: session.data
            }
        });
        
    } catch (error) {
        console.error('Update preference error:', error);
        
        emitSocketEvent(req, 'agent-error', {
            sessionId: req.body.sessionId,
            error: error.message,
            timestamp: new Date()
        }, req.body.sessionId);
        
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update seating preference',
            message: error.message 
        });
    }
});

router.post('/create-booking', async (req, res) => {
    try {
        const { sessionId, weatherData, seatingPreference: frontendSeatingPref } = req.body;
        
        if (!sessionId || !conversationSessions.has(sessionId)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid session' 
            });
        }
        
        const session = conversationSessions.get(sessionId);
        const data = session.data;
        
        let bookingDate = data.parsedDate || new Date();
        
        if (bookingDate < new Date()) {
            bookingDate.setDate(bookingDate.getDate() + 1);
        }
        
        const finalSeatingPreference = frontendSeatingPref || 
                                       data.seatingPreference || 
                                       weatherData?.seatingPreference || 
                                       'no preference';
        
        console.log('🪑 Seating Preference Resolution:');
        console.log('  - Frontend:', frontendSeatingPref);
        console.log('  - Session Data:', data.seatingPreference);
        console.log('  - Weather Suggestion:', weatherData?.seatingPreference);
        console.log('  - FINAL:', finalSeatingPreference);
        
        const bookingData = {
            customerName: data.customerName,
            numberOfGuests: data.numberOfGuests,
            bookingDate,
            bookingTime: data.timeText || '19:00',
            cuisinePreference: data.cuisinePreference || 'Other',
            specialRequests: Array.isArray(data.specialRequests) 
                ? data.specialRequests.join(', ') 
                : (data.specialRequests || ''),
            weatherInfo: weatherData,
            seatingPreference: finalSeatingPreference,
            status: 'confirmed'
        };
        
        const booking = new Booking(bookingData);
        await booking.save();
        
        console.log('✅ Booking created with seating:', booking.seatingPreference);
        
        const response = generateResponse('final_confirmation', {
            name: data.customerName,
            bookingId: booking.bookingId,
            date: data.dateText,
            time: data.timeText
        });
        
        emitSocketEvent(req, 'voice-booking-created', {
            sessionId,
            booking,
            message: `Voice booking created: ${booking.bookingId}`,
            timestamp: new Date()
        });
        
        conversationSessions.delete(sessionId);
        
        res.json({
            success: true,
            data: {
                booking,
                response
            }
        });
        
    } catch (error) {
        console.error('Booking Creation Error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to create booking',
            message: error.message 
        });
    }
});

router.post('/reset', (req, res) => {
    const { sessionId } = req.body;
    if (sessionId && conversationSessions.has(sessionId)) {
        conversationSessions.delete(sessionId);
        
        emitSocketEvent(req, 'session-reset', {
            sessionId,
            message: 'Conversation reset',
            timestamp: new Date()
        }, sessionId);
    }
    res.json({ success: true, message: 'Session reset successfully' });
});

router.get('/session/:id', (req, res) => {
    const sessionId = req.params.id;
    if (!conversationSessions.has(sessionId)) {
        return res.status(404).json({ success: false, error: 'Session not found' });
    }
    res.json({ success: true, data: conversationSessions.get(sessionId) });
});

module.exports = router;