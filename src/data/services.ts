export interface Service {
  id: string;
  name: string;
  description: string;
  min_price: number;
  icon: string;
}

export const services: Service[] = [
  {
    id: 'soft-gel',
    name: 'Uñas Soft Gel',
    description: 'Aplicación de uñas soft gel con un acabado natural y duradero.',
    min_price: 40,
    icon: '/icons/Soft_nails.svg',
  },
  {
    id: 'builder-gel',
    name: 'Uñas Builder Gel',
    description: 'Aplicación de uñas con builder gel para mayor resistencia y durabilidad.',
    min_price: 40,
    icon: '/icons/Hard_nails.svg',
  },
  {
    id: 'poligel',
    name: 'Poligel',
    description: 'Aplicación de uñas poli gel con un acabado natural y duradero.',
    min_price: 45,
    icon: '/icons/Soft_nails.svg',
  },
  {
    id: 'manicure-combinada',
    name: 'Manicura combinada incluido (limpieza)',
    description: 'Manicura combinada que incluye limpieza.',
    min_price: 0,
    icon: '/icons/Manicure.svg',
  },
  {
    id: 'removal',
    name: 'Retirado',
    description: 'Servicio de retirado de uñas.',
    min_price: 0,
    icon: '/icons/Removal.svg',
  },
  {
    id: 'koki-previo-gratis',
    name: 'Gratis si es trabajo previo de Koki',
    description: 'Servicio gratuito cuando es trabajo previo de Koki.',
    min_price: 0,
    icon: '/icons/Discount.svg',
  },
  {
    id: 'externo-5',
    name: '5 si es externo',
    description: 'Servicio con precio de 5 para clientes externos.',
    min_price: 5,
    icon: '/icons/External.svg',
  },
  {
    id: 'remover-sin-extra-15',
    name: '15 solo remover sin servicio extra',
    description: 'Remoción sin servicios adicionales.',
    min_price: 15,
    icon: '/icons/Removal.svg',
  },
  {
    id: 'nivelacion-builder',
    name: 'Nivelación con Builder Gel',
    description: 'Nivelación de uñas usando builder gel.',
    min_price: 40,
    icon: '/icons/Hard_nails.svg',
  },
  {
    id: 'nivelacion-builder-color',
    name: 'Más color +$5',
    description: 'Añadir color adicional por 5 extra.',
    min_price: 45,
    icon: '/icons/Color.svg',
  },
  {
    id: 'nivelacion-rubber',
    name: 'Nivelación con Rubber Base',
    description: 'Nivelación de uñas usando rubber base.',
    min_price: 40,
    icon: '/icons/Rubber.svg',
  },
  {
    id: 'nivelacion-rubber-color',
    name: 'Más color +$5',
    description: 'Añadir color adicional por 5 extra.',
    min_price: 45,
    icon: '/icons/Color.svg',
  },
  {
    id: 'pedicura-estetica',
    name: 'Pedicura Estética',
    description: 'Pedicura estética para embellecer los pies.',
    min_price: 45,
    icon: '/icons/Pedicure.svg',
  },
  {
    id: 'pedicura-spa',
    name: 'Pedicura Spa',
    description: 'Pedicura tipo spa con tratamientos relajantes.',
    min_price: 50,
    icon: '/icons/Pedicure.svg',
  },
  {
    id: 'brow-lamination',
    name: 'Brow Lamination',
    description: 'Laminado de cejas para mayor definición.',
    min_price: 45,
    icon: '/icons/Brow.svg',
  },
  {
    id: 'lash-lifting',
    name: 'Lash Lifting',
    description: 'Elevación de pestañas para un look más abierto.',
    min_price: 45,
    icon: '/icons/Lash.svg',
  },
  {
    id: 'henna-brows',
    name: 'Henna Brows',
    description: 'Aplicación de henna en las cejas.',
    min_price: 35,
    icon: '/icons/Brow.svg',
  },
];