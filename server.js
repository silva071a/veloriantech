import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import MercadoPago, { Preference } from '@mercadopago/sdk-nodejs';

dotenv.config();
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

if (!process.env.MP_ACCESS_TOKEN) {
  console.warn('MP_ACCESS_TOKEN não configurado. Configure o arquivo .env antes de usar pagamentos reais.');
}

const products = {
  1: { title: 'Power Bank Turbo 20000mAh 66W Premium', unit_price: 149.90 },
  2: { title: 'Fone De Ouvido Bluetooth Sem Fio Estéreo', unit_price: 79.90 },
  3: { title: 'Smartwatch 6 Em 1 Tela AMOLED 2.02', unit_price: 99.90 }
};

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/create-preference', async (req, res) => {
  try {
    if (!process.env.MP_ACCESS_TOKEN) {
      return res.status(500).json({ error: 'Pagamento ainda não foi configurado pelo administrador.' });
    }

    const { customer, items } = req.body;
    if (!customer?.name || !customer?.address || !customer?.phone || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'Dados do pedido incompletos.' });
    }

    const preferenceItems = items.map(item => {
      const product = products[item.id];
      const quantity = Number(item.quantity);
      if (!product || !Number.isInteger(quantity) || quantity < 1) throw new Error('Produto ou quantidade inválidos.');
      return { id: String(item.id), title: product.title, quantity, currency_id: 'BRL', unit_price: product.unit_price };
    });

    const client = new MercadoPago({ accessToken: process.env.MP_ACCESS_TOKEN });
    const preference = new Preference(client);
    const baseUrl = process.env.BASE_URL;
    const body = {
      items: preferenceItems,
      external_reference: `VT-${Date.now()}`,
      metadata: { customer_name: customer.name, customer_address: customer.address, customer_phone: customer.phone, selected_payment: customer.payment },
      shipments: { cost: 0, free_shipping: true },
      ...(baseUrl ? {
        back_urls: { success: `${baseUrl}/success.html`, pending: `${baseUrl}/pending.html`, failure: `${baseUrl}/failure.html` },
        auto_return: 'approved'
      } : {})
    };

    const result = await preference.create({ body });
    res.json({ id: result.id, init_point: result.init_point });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Não foi possível criar o checkout. Verifique a configuração do Mercado Pago.' });
  }
});

app.listen(PORT, () => console.log(`VelorianTech disponível em http://localhost:${PORT}`));
