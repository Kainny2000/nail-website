export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
  category: string;
  isAddon?: boolean;
}

export interface Category {
  id: string;
  name: string;
  description: string;
}

export const categories: Category[] = [
  { id: 'nails', name: 'Uñas', description: 'Servicios principales de uñas' },
  { id: 'pedicure', name: 'Pedicura', description: 'Cuidado para tus pies' },
  { id: 'brows-lashes', name: 'Cejas y Pestañas', description: 'Mirada perfecta' },
  { id: 'removal', name: 'Retirado', description: 'Servicios de remoción' },
  { id: 'addons', name: 'Extras', description: 'Complementos para tus servicios' },
];

export const services: Service[] = [
  // Uñas
  {
    id: 'soft-gel',
    name: 'Uñas Soft Gel',
    description: 'Acabado natural y duradero.',
    price: 55,
    icon: '/icons/Soft_nails.svg',
    category: 'nails',
  },
  {
    id: 'builder-gel',
    name: 'Uñas Builder Gel',
    description: 'Mayor resistencia y durabilidad.',
    price: 50,
    icon: '/icons/Hard_nails.svg',
    category: 'nails',
  },
  {
    id: 'poligel',
    name: 'Poligel',
    description: 'Acabado natural y duradero.',
    price: 50,
    icon: '/icons/Soft_nails.svg',
    category: 'nails',
  },
  {
    id: 'nivelacion-rubber',
    name: 'Nivelación con Rubber Base',
    description: 'Nivelación de uñas usando rubber base.',
    price: 45,
    icon: '/icons/Rubber.svg',
    category: 'nails',
  },

  // Pedicura
  {
    id: 'pedicura-estetica',
    name: 'Pedicura Estética',
    description: 'Embellece tus pies.',
    price: 45,
    icon: '/icons/Pedicure.svg',
    category: 'pedicure',
  },
  {
    id: 'pedicura-spa',
    name: 'Pedicura Spa',
    description: 'Tratamientos relajantes.',
    price: 50,
    icon: '/icons/Pedicure.svg',
    category: 'pedicure',
  },

  // Cejas y Pestañas
  {
    id: 'brow-lamination',
    name: 'Brow Lamination',
    description: 'Mayor definición para tus cejas.',
    price: 45,
    icon: '/icons/Brow.svg',
    category: 'brows-lashes',
  },
  {
    id: 'lash-lifting',
    name: 'Lash Lifting',
    description: 'Elevación de pestañas.',
    price: 45,
    icon: '/icons/Lash.svg',
    category: 'brows-lashes',
  },
  {
    id: 'henna-brows',
    name: 'Henna Brows',
    description: 'Aplicación de henna en las cejas.',
    price: 35,
    icon: '/icons/Brow.svg',
    category: 'brows-lashes',
  },

  // Retirado
  {
    id: 'removal-koki',
    name: 'Retirado (Koki)',
    description: 'Gratis si es trabajo previo de Koki.',
    price: 0,
    icon: '/icons/Discount.svg',
    category: 'removal',
  },
  {
    id: 'removal-external',
    name: 'Retirado Externo',
    description: 'Si el trabajo previo es de otro lugar.',
    price: 5,
    icon: '/icons/External.svg',
    category: 'removal',
  },
  {
    id: 'removal-only',
    name: 'Solo Retirado',
    description: 'Sin servicio extra.',
    price: 15,
    icon: '/icons/Removal.svg',
    category: 'removal',
  },

  // Extras
  {
    id: 'extra-color',
    name: 'Color Adicional',
    description: 'Añade máscolor y diseño a tu nivelación.',
    price: 5,
    icon: '/icons/Color.svg',
    category: 'addons',
    isAddon: true,
  },
];