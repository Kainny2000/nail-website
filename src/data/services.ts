export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
  category: string;
  isAddon?: boolean;
  basePrice?: boolean;
}

export interface Category {
  id: string;
  name: string;
  description: string;
}

export const categories: Category[] = [
  { id: 'nails', name: 'Uñas', description: 'Servicios principales de uñas' },
  { id: 'removal', name: 'Retirado', description: 'Servicios de remoción' },
  { id: 'pedicure', name: 'Pedicuras', description: 'Servicios de pedicura' },
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
    id: 'polygel',
    name: 'Polygel',
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

  // Retirado
  {
    id: 'removal-koki',
    name: 'Retirado (trabajo previo de Bareform)',
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

];