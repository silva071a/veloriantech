import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { MercadoPagoConfig, Preference } from 'mercadopago';

dotenv.config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

const ORDERS_FILE = path.join(__dirname, 'orders.json');

/* =========================================
   CONFIGURAÇÕES
========================================= */

if (!process.env.MP_ACCESS_TOKEN) {
  console.warn(
    'MP_ACCESS_TOKEN não configurado. Configure a variável no Render antes de usar pagamentos reais.'
  );
}

const products = {
  1: {
    title: 'Power Bank Turbo 20000mAh 66W Premium',
    unit_price: 149.90
  },

  2: {
    title: 'Fone De Ouvido Bluetooth Sem Fio Estéreo',
    unit_price: 79.90
  },

  3: {
    title: 'Smartwatch 6 Em 1 Tela AMOLED 2.02',
    unit_price: 99.90
  }
};

const allowedStatus = [
  'Novo',
  'Em preparação',
  'Enviado',
  'Concluído',
  'Cancelado'
];

/* =========================================
   MIDDLEWARE
========================================= */

app.use(express.json());

app.use(
  express.static(
    path.join(__dirname, 'public')
  )
);

/* =========================================
   ARQUIVO DE PEDIDOS
========================================= */

function getOrders() {
  try {
    if (!fs.existsSync(ORDERS_FILE)) {
      fs.writeFileSync(
        ORDERS_FILE,
        JSON.stringify([], null, 2),
        'utf8'
      );
    }

    const data = fs.readFileSync(
      ORDERS_FILE,
      'utf8'
    );

    const orders = JSON.parse(
      data || '[]'
    );

    return Array.isArray(orders)
      ? orders
      : [];

  } catch (error) {
    console.error(
      'Erro ao carregar pedidos:',
      error
    );

    return [];
  }
}

function saveOrders(orders) {
  try {
    fs.writeFileSync(
      ORDERS_FILE,
      JSON.stringify(orders, null, 2),
      'utf8'
    );

    return true;

  } catch (error) {
    console.error(
      'Erro ao salvar pedidos:',
      error
    );

    return false;
  }
}

/* =========================================
   GERAR ID DO PEDIDO
========================================= */

function generateOrderId() {
  const date = new Date();

  const datePart =
    date.getFullYear().toString().slice(-2) +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0');

  const random =
    Math.floor(
      1000 + Math.random() * 9000
    );

  return `VT-${datePart}-${random}`;
}

/* =========================================
   VALIDAR PRODUTOS
========================================= */

function processOrderItems(items) {

  if (
    !Array.isArray(items) ||
    !items.length
  ) {
    throw new Error(
      'O pedido não possui produtos.'
    );
  }

  const orderItems = [];

  let total = 0;

  for (const item of items) {

    const product =
      products[Number(item.id)];

    const quantity =
      Number(
        item.quantity ?? item.qty
      );

    if (
      !product ||
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      throw new Error(
        'Produto ou quantidade inválidos.'
      );
    }

    const subtotal =
      product.unit_price * quantity;

    total += subtotal;

    orderItems.push({
      id: Number(item.id),
      title: product.title,
      quantity,
      unit_price: product.unit_price,
      subtotal
    });
  }

  return {
    items: orderItems,
    total
  };
}

/* =========================================
   CRIAR PEDIDO
========================================= */

app.post(
  '/api/orders',
  (req, res) => {

    try {

      const {
        customer,
        items,
        payment
      } = req.body;

      if (
        !customer ||
        !customer.name ||
        !customer.phone ||
        !customer.address
      ) {
        return res.status(400).json({
          error:
            'Dados do cliente incompletos.'
        });
      }

      const processed =
        processOrderItems(items);

      const orders =
        getOrders();

      const order = {

        id:
          generateOrderId(),

        created_at:
          new Date().toISOString(),

        status:
          'Novo',

        payment:
          payment ||
          'Não informado',

        customer: {

          name:
            String(customer.name),

          phone:
            String(customer.phone),

          address:
            String(customer.address)

        },

        items:
          processed.items,

        total:
          processed.total

      };

      orders.unshift(order);

      if (!saveOrders(orders)) {

        return res.status(500).json({
          error:
            'Não foi possível salvar o pedido.'
        });

      }

      console.log(
        `Novo pedido recebido: ${order.id}`
      );

      return res.status(201).json({

        success: true,

        order

      });

    } catch (error) {

      console.error(
        'Erro ao criar pedido:',
        error
      );

      return res.status(500).json({

        error:
          error.message ||
          'Erro interno ao criar o pedido.'

      });
    }
  }
);

/* =========================================
   LISTAR PEDIDOS
========================================= */

app.get(
  '/api/orders',
  (req, res) => {

    try {

      const orders =
        getOrders();

      res.json(orders);

    } catch (error) {

      console.error(
        'Erro ao listar pedidos:',
        error
      );

      res.status(500).json({
        error:
          'Não foi possível carregar os pedidos.'
      });

    }
  }
);

/* =========================================
   ALTERAR STATUS
========================================= */

app.patch(
  '/api/orders/:id/status',
  (req, res) => {

    try {

      const {
        status
      } = req.body;

      if (
        !allowedStatus.includes(status)
      ) {

        return res.status(400).json({
          error:
            'Status inválido.'
        });

      }

      const orders =
        getOrders();

      const order =
        orders.find(
          item =>
            item.id === req.params.id
        );

      if (!order) {

        return res.status(404).json({
          error:
            'Pedido não encontrado.'
        });

      }

      order.status =
        status;

      order.updated_at =
        new Date().toISOString();

      if (!saveOrders(orders)) {

        return res.status(500).json({
          error:
            'Não foi possível salvar o status.'
        });

      }

      res.json({

        success: true,

        order

      });

    } catch (error) {

      console.error(
        'Erro ao alterar status:',
        error
      );

      res.status(500).json({
        error:
          'Erro interno ao alterar status.'
      });

    }
  }
);

/* =========================================
   MERCADO PAGO
========================================= */

app.post(
  '/api/create-preference',
  async (req, res) => {

    try {

      if (
        !process.env.MP_ACCESS_TOKEN
      ) {

        return res.status(500).json({
          error:
            'Pagamento ainda não foi configurado pelo administrador.'
        });

      }

      const {
        customer,
        items
      } = req.body;

      if (
        !customer?.name ||
        !customer?.address ||
        !customer?.phone ||
        !Array.isArray(items) ||
        !items.length
      ) {

        return res.status(400).json({
          error:
            'Dados do pedido incompletos.'
        });

      }

      const preferenceItems =
        items.map(item => {

          const product =
            products[
              Number(item.id)
            ];

          const quantity =
            Number(
              item.quantity ?? item.qty
            );

          if (
            !product ||
            !Number.isInteger(quantity) ||
            quantity < 1
          ) {

            throw new Error(
              'Produto ou quantidade inválidos.'
            );

          }

          return {

            id:
              String(item.id),

            title:
              product.title,

            quantity,

            currency_id:
              'BRL',

            unit_price:
              product.unit_price

          };

        });

      const client =
        new MercadoPagoConfig({

          accessToken:
            process.env.MP_ACCESS_TOKEN

        });

      const preference =
        new Preference(client);

      const baseUrl =
        process.env.BASE_URL;

      const body = {

        items:
          preferenceItems,

        external_reference:
          generateOrderId(),

        metadata: {

          customer_name:
            customer.name,

          customer_address:
            customer.address,

          customer_phone:
            customer.phone

        },

        shipments: {

          cost: 0

        },

        ...(baseUrl
          ? {

              back_urls: {

                success:
                  `${baseUrl}/success.html`,

                pending:
                  `${baseUrl}/pending.html`,

                failure:
                  `${baseUrl}/failure.html`

              },

              auto_return:
                'approved'

            }

          : {})

      };

      const result =
        await preference.create({
          body
        });

      res.json({

        id:
          result.id,

        init_point:
          result.init_point

      });

    } catch (error) {

      console.error(
        'Erro Mercado Pago:',
        error
      );

      res.status(500).json({

        error:
          'Não foi possível criar o checkout. Verifique a configuração do Mercado Pago.'

      });

    }
  }
);

/* =========================================
   ROTA PRINCIPAL
========================================= */

app.get(
  '/',
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        'public',
        'index.html'
      )
    );

  }
);

/* =========================================
   INICIAR SERVIDOR
========================================= */

app.listen(
  PORT,
  () => {

    console.log(
      `VelorianTech disponível na porta ${PORT}`
    );

  }
);
