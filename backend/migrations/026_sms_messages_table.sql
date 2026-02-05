-- Migration: Create sms_messages table for Twilio SMS integration
-- Date: 2025-01-31
-- Description: Store SMS messages for two-way communication with clients

-- ============================================
-- 1. Create sms_messages table
-- ============================================

CREATE TABLE IF NOT EXISTS sms_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    phone_number VARCHAR(20) NOT NULL,
    message_body TEXT NOT NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    twilio_sid VARCHAR(50),
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'received')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraint for company_id
ALTER TABLE sms_messages
ADD CONSTRAINT sms_messages_company_id_fkey
FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE;

-- ============================================
-- 2. Create indexes for faster lookups
-- ============================================

CREATE INDEX IF NOT EXISTS idx_sms_messages_company_id ON sms_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_customer_id ON sms_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_phone_number ON sms_messages(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_messages_created_at ON sms_messages(created_at DESC);
-- Partial index for unread messages (efficient for badge count queries)
CREATE INDEX IF NOT EXISTS idx_sms_messages_unread ON sms_messages(company_id) WHERE is_read = FALSE AND direction = 'inbound';

-- ============================================
-- 3. Enable RLS on sms_messages
-- ============================================

ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for sms_messages
CREATE POLICY "Users can view their company's sms messages"
    ON sms_messages FOR SELECT
    USING (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

CREATE POLICY "Users can insert sms messages for their company"
    ON sms_messages FOR INSERT
    WITH CHECK (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

CREATE POLICY "Users can update their company's sms messages"
    ON sms_messages FOR UPDATE
    USING (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

CREATE POLICY "Users can delete their company's sms messages"
    ON sms_messages FOR DELETE
    USING (company_id IN (
        SELECT raw_user_meta_data->>'companyID'
        FROM auth.users 
        WHERE id = auth.uid()
    ));

-- ============================================
-- 4. Create trigger for updated_at
-- ============================================

-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sms_messages_updated_at ON sms_messages;
CREATE TRIGGER update_sms_messages_updated_at
    BEFORE UPDATE ON sms_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. Add comments for documentation
-- ============================================

COMMENT ON TABLE sms_messages IS 'Stores SMS messages sent and received via Twilio';
COMMENT ON COLUMN sms_messages.direction IS 'inbound = received from customer, outbound = sent to customer';
COMMENT ON COLUMN sms_messages.twilio_sid IS 'Twilio message SID for tracking delivery status';
COMMENT ON COLUMN sms_messages.status IS 'Message delivery status: sent, delivered, failed, received';
COMMENT ON COLUMN sms_messages.is_read IS 'Whether the message has been read by the company user';
