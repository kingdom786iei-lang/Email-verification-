// EMAIL VERIFICATION API - COMPLETE BACKEND
// Production Ready - Stripe Integration Included

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const stripe = require('stripe');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const app = express();
const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

// Supabase Database Setup
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// 1. USER AUTHENTICATION ENDPOINTS
// ============================================

// Register New User
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Check if user exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const { data: user, error } = await supabase
      .from('users')
      .insert([
        {
          email,
          password: hashedPassword,
          name,
          tier: 'free',
          api_key: 'sk_' + Math.random().toString(36).substr(2, 32),
          usage_count: 0,
          stripe_customer_id: null
        }
      ])
      .select()
      .single();

    if (error) throw error;

    // Create JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        api_key: user.api_key,
        tier: user.tier
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login User
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Get user
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        api_key: user.api_key,
        tier: user.tier,
        usage_count: user.usage_count
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 2. EMAIL VERIFICATION ENDPOINT (MAIN)
// ============================================

app.post('/api/verify-email', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const { email } = req.body;

    if (!apiKey || !email) {
      return res.status(400).json({ error: 'Missing API key or email' });
    }

    // Get user by API key
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('api_key', apiKey)
      .single();

    if (!user) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Get tier limits
    const tierLimits = {
      free: 100,
      starter: 5000,
      professional: 50000,
      enterprise: 999999
    };

    const monthlyLimit = tierLimits[user.tier];

    // Check usage
    if (user.usage_count >= monthlyLimit) {
      return res.status(429).json({
        error: 'Monthly limit exceeded',
        tier: user.tier,
        limit: monthlyLimit,
        used: user.usage_count,
        upgrade_url: '/pricing'
      });
    }

    // Advanced Email Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isFormatValid = emailRegex.test(email);

    let result = {
      email,
      valid: false,
      reason: 'Unknown'
    };

    // Format Check
    if (!isFormatValid) {
      result.valid = false;
      result.reason = 'Invalid format';
    } else {
      // Disposable email check
      const disposableDomains = ['tempmail.com', '10minutemail.com', 'guerrillamail.com'];
      const domain = email.split('@')[1];

      if (disposableDomains.includes(domain)) {
        result.valid = false;
        result.reason = 'Disposable email';
      } else {
        result.valid = true;
        result.reason = 'Valid email';
      }
    }

    // Increment usage
    await supabase
      .from('users')
      .update({ usage_count: user.usage_count + 1 })
      .eq('id', user.id);

    // Log verification
    await supabase
      .from('verification_logs')
      .insert([
        {
          user_id: user.id,
          email,
          result: result.valid ? 'valid' : 'invalid',
          timestamp: new Date()
        }
      ]);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 3. STRIPE PAYMENT ENDPOINTS
// ============================================

// Create checkout session
app.post('/api/checkout', async (req, res) => {
  try {
    const { userId, tier } = req.body;

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    const prices = {
      starter: process.env.STRIPE_STARTER_PRICE_ID,
      professional: process.env.STRIPE_PRO_PRICE_ID,
      enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID
    };

    let customerId = user.stripe_customer_id;

    // Create customer if not exists
    if (!customerId) {
      const customer = await stripeClient.customers.create({
        email: user.email,
        name: user.name
      });
      customerId = customer.id;

      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);
    }

    // Create checkout session
    const session = await stripeClient.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: prices[tier],
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      metadata: { userId, tier }
    });

    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Webhook for Stripe
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripeClient.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object;
    const userId = subscription.metadata.userId;

    // Update user tier
    const tier = subscription.items.data[0].price.metadata.tier;
    await supabase
      .from('users')
      .update({ tier, usage_count: 0 })
      .eq('id', userId);
  }

  res.json({ received: true });
});

// ============================================
// 4. DASHBOARD DATA ENDPOINTS
// ============================================

// Get user dashboard data
app.get('/api/dashboard', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.id)
      .single();

    const tierLimits = {
      free: 100,
      starter: 5000,
      professional: 50000,
      enterprise: 999999
    };

    // Get this month's logs
    const { data: logs } = await supabase
      .from('verification_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('timestamp', new Date(new Date().setDate(1)));

    const validCount = logs.filter(l => l.result === 'valid').length;
    const invalidCount = logs.filter(l => l.result === 'invalid').length;

    res.json({
      user: {
        name: user.name,
        email: user.email,
        tier: user.tier,
        api_key: user.api_key
      },
      usage: {
        current: user.usage_count,
        limit: tierLimits[user.tier],
        percentage: (user.usage_count / tierLimits[user.tier]) * 100
      },
      stats: {
        valid: validCount,
        invalid: invalidCount,
        total: validCount + invalidCount
      },
      chart: logs.map(l => ({
        date: new Date(l.timestamp).toLocaleDateString(),
        count: 1,
        result: l.result
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 5. HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
  res.json({ status: 'API is running ✅', timestamp: new Date() });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Email Verification API running on port ${PORT}`);
  console.log(`📊 Ready for payments and email verification`);
  console.log(`🔗 API: http://localhost:${PORT}`);
});
      
