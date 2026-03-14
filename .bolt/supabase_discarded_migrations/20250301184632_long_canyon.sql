/*
  # Add formation templates

  1. Update formations table
    - Add default templates for existing formations
  
  2. Add sample formations
    - Add common offensive and defensive formations with player positions
*/

-- Update existing formations with default templates
UPDATE formations
SET template = '{"objects":[
  {"type":"group","objects":[
    {"type":"circle","radius":12,"fill":"#3B82F6","stroke":"#3B82F6","left":150,"top":250,"originX":"center","originY":"center"},
    {"type":"text","text":"X","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":150,"top":250,"originX":"center","originY":"center"}
  ],"left":150,"top":250,"originX":"center","originY":"center","name":"player"},
  {"type":"group","objects":[
    {"type":"circle","radius":12,"fill":"#3B82F6","stroke":"#3B82F6","left":250,"top":250,"originX":"center","originY":"center"},
    {"type":"text","text":"Y","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":250,"top":250,"originX":"center","originY":"center"}
  ],"left":250,"top":250,"originX":"center","originY":"center","name":"player"},
  {"type":"group","objects":[
    {"type":"circle","radius":12,"fill":"#3B82F6","stroke":"#3B82F6","left":350,"top":250,"originX":"center","originY":"center"},
    {"type":"text","text":"Z","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":350,"top":250,"originX":"center","originY":"center"}
  ],"left":350,"top":250,"originX":"center","originY":"center","name":"player"},
  {"type":"group","objects":[
    {"type":"rect","width":24,"height":24,"fill":"#000000","stroke":"#000000","left":250,"top":300,"originX":"center","originY":"center"},
    {"type":"text","text":"C","fontSize":16,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":250,"top":300,"originX":"center","originY":"center"}
  ],"left":250,"top":300,"originX":"center","originY":"center","name":"player"},
  {"type":"group","objects":[
    {"type":"circle","radius":12,"fill":"#EF4444","stroke":"#EF4444","left":250,"top":350,"originX":"center","originY":"center"},
    {"type":"text","text":"Q","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":250,"top":350,"originX":"center","originY":"center"}
  ],"left":250,"top":350,"originX":"center","originY":"center","name":"player"}
],"width":500,"height":500}'
WHERE name = 'Shotgun';

UPDATE formations
SET template = '{"objects":[
  {"type":"group","objects":[
    {"type":"circle","radius":12,"fill":"#3B82F6","stroke":"#3B82F6","left":150,"top":250,"originX":"center","originY":"center"},
    {"type":"text","text":"X","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":150,"top":250,"originX":"center","originY":"center"}
  ],"left":150,"top":250,"originX":"center","originY":"center","name":"player"},
  {"type":"group","objects":[
    {"type":"circle","radius":12,"fill":"#3B82F6","stroke":"#3B82F6","left":350,"top":250,"originX":"center","originY":"center"},
    {"type":"text","text":"Y","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":350,"top":250,"originX":"center","originY":"center"}
  ],"left":350,"top":250,"originX":"center","originY":"center","name":"player"},
  {"type":"group","objects":[
    {"type":"rect","width":24,"height":24,"fill":"#000000","stroke":"#000000","left":250,"top":300,"originX":"center","originY":"center"},
    {"type":"text","text":"C","fontSize":16,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":250,"top":300,"originX":"center","originY":"center"}
  ],"left":250,"top":300,"originX":"center","originY":"center","name":"player"},
  {"type":"group","objects":[
    {"type":"circle","radius":12,"fill":"#EF4444","stroke":"#EF4444","left":250,"top":350,"originX":"center","originY":"center"},
    {"type":"text","text":"Q","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":250,"top":350,"originX":"center","originY":"center"}
  ],"left":250,"top":350,"originX":"center","originY":"center","name":"player"},
  {"type":"group","objects":[
    {"type":"circle","radius":12,"fill":"#9333EA","stroke":"#9333EA","left":250,"top":400,"originX":"center","originY":"center"},
    {"type":"text","text":"H","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":250,"top":400,"originX":"center","originY":"center"}
  ],"left":250,"top":400,"originX":"center","originY":"center","name":"player"},
  {"type":"group","objects":[
    {"type":"circle","radius":12,"fill":"#EAB308","stroke":"#EAB308","left":250,"top":450,"originX":"center","originY":"center"},
    {"type":"text","text":"R1","fontSize":12,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":250,"top":450,"originX":"center","originY":"center"}
  ],"left":250,"top":450,"originX":"center","originY":"center","name":"player"}
],"width":500,"height":500}'
WHERE name = 'I-Formation';

UPDATE formations
SET template = '{"objects":[
  {"type":"group","objects":[
    {"type":"circle","radius":12,"fill":"#3B82F6","stroke":"#3B82F6","left":150,"top":250,"originX":"center","originY":"center"},
    {"type":"text","text":"X","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":150,"top":250,"originX":"center","originY":"center"}
  ],"left":150,"top":250,"originX":"center","originY":"center","name":"player"},
  {"type":"group","objects":[
    {"type":"circle","radius":12,"fill":"#3B82F6","stroke":"#3B82F6","left":200,"top":250,"originX":"center","originY":"center"},
    {"type":"text","text":"X","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":200,"top":250,"originX":"center","originY":"center"}
  ],"left":200,"top":250,"originX":"center","originY":"center","name":"player"},
  {"type":"group","objects":[
    {"type":"circle","radius":12,"fill":"#3B82F6","stroke":"#3B82F6","left":250,"top":250,"originX":"center","originY":"center"},
    {"type":"text","text":"X","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":250,"top":250,"originX":"center","originY":"center"}
  ],"left":250,"top":250,"originX":"center","originY":"center","name":"player"},
  {"type":"group","objects":[
    {"type":"circle","radius":12,"fill":"#3B82F6","stroke":"#3B82F6","left":300,"top":250,"originX":"center","originY":"center"},
    {"type":"text","text":"X","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":300,"top":250,"originX":"center","originY":"center"}
  ],"left":300,"top":250,"originX":"center","originY":"center","name":"player"},
  {"type":"group","objects":[
    {"type":"circle","radius":12,"fill":"#10B981","stroke":"#10B981","left":175,"top":300,"originX":"center","originY":"center"},
    {"type":"text","text":"Y","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":175,"top":300,"originX":"center","originY":"center"}
  ],"left":175,"top":300,"originX":"center","originY":"center","name":"player"},
  {"type":"group","objects":[
    {"type":"circle","radius":12,"fill":"#10B981","stroke":"#10B981","left":225,"top":300,"originX":"center","originY":"center"},
    {"type":"text","text":"Y","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":225,"top":300,"originX":"center","originY":"center"}
  ],"left":225,"top":300,"originX":"center","originY":"center","name":"player"},
  {"type":"group","objects":[
    {"type":"circle","radius":12,"fill":"#10B981","stroke":"#10B981","left":275,"top":300,"originX":"center","originY":"center"},
    {"type":"text","text":"Y","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":275,"top":300,"originX":"center","originY":"center"}
  ],"left":275,"top":300,"originX":"center","originY":"center","name":"player"}
],"width":500,"height":500}'
WHERE name = '4-3 Defense';

UPDATE formations
SET template = '{"objects":[
  {"type":"group","objects":[
    {"type":"circle","radius":12,"fill":"#3B82F6","stroke":"#3B82F6","left":175,"top":250,"originX":"center","originY":"center"},
    {"type":"text","text":"X","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":175,"top":250,"originX":"center","originY":"center"}
  ],"left":175,"top":250,"originX":"center","originY":"center","name":"player"},
  {"type":"group","objects":[
    {"type":"circle","radius":12,"fill":"#3B82F6","stroke":"#3B82F6","left":250,"top":250,"originX":"center","originY":"center"},
    {"type":"text","text":"X","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":250,"top":250,"originX":"center","originY":"center"}
  ],"left":250,"top":250,"originX":"center","originY":"center","name":"player"},
  {"type":"group","objects":[
    {"type":"circle","radius":12,"fill":"#3B82F6","stroke":"#3B82F6","left":325,"top":250,"originX":"center","originY":"center"},
    {"type":"text","text":"X","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":325,"top":250,"originX":"center","originY":"center"}
  ],"left":325,"top":250,"originX":"center","originY":"center","name":"player"},
  {"type":"group","objects":[
    {"type":"circle","radius":12,"fill":"#10B981","stroke":"#10B981","left":150,"top":300,"originX":"center","originY":"center"},
    {"type":"text","text":"Y","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":150,"top":300,"originX":"center","originY":"center"}
  ],"left":150,"top":300,"originX":"center","originY":"center","name":"player"},
  {"type":"group","objects":[
    {"type":"circle","radius":12,"fill":"#10B981","stroke":"#10B981","left":200,"top":300,"originX":"center","originY":"center"},
    {"type":"text","text":"Y","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":200,"top":300,"originX":"center","originY":"center"}
  ],"left":200,"top":300,"originX":"center","originY":"center","name":"player"},
  {"type":"group","objects":[
    {"type":"circle","radius":12,"fill":"#10B981","stroke":"#10B981","left":300,"top":300,"originX":"center","originY":"center"},
    {"type":"text","text":"Y","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":300,"top":300,"originX":"center","originY":"center"}
  ],"left":300,"top":300,"originX":"center","originY":"center","name":"player"},
  {"type":"group","objects":[
    {"type":"circle","radius":12,"fill":"#10B981","stroke":"#10B981","left":350,"top":300,"originX":"center","originY":"center"},
    {"type":"text","text":"Y","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":350,"top":300,"originX":"center","originY":"center"}
  ],"left":350,"top":300,"originX":"center","originY":"center","name":"player"}
],"width":500,"height":500}'
WHERE name = '3-4 Defense';

UPDATE formations
SET template = '{"objects":[
  {"type":"group","objects":[
    {"type":"circle","radius":12,"fill":"#3B82F6","stroke":"#3B82F6","left":150,"top":250,"originX":"center","originY":"center"},
    {"type":"text","text":"X","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":150,"top":250,"originX":"center","originY":"center"}
  ],"left":150,"top":250,"originX":"center","originY":"center","name":"player"},
  {"type":"group","objects":[
    {"type":"circle","radius":12,"fill":"#3B82F6","stroke":"#3B82F6","left":200,"top":250,"originX":"center","originY":"center"},
    {"type":"text","text":"X","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":200,"top":250,"originX":"center","originY":"center"}
  ],"left":200,"top":250,"originX":"center","originY":"center","name":"player"},
  {"type":"group","objects":[
    {"type":"rect","width":24,"height":24,"fill":"#000000","stroke":"#000000","left":250,"top":250,"originX":"center","originY":"center"},
    {"type":"text","text":"C","fontSize":16,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":250,"top":250,"originX":"center","originY":"center"}
  ],"left":250,"top":250,"originX":"center","originY":"center","name":"player"},
  {"type":"group","objects":[
    {"type":"circle","radius":12,"fill":"#3B82F6","stroke":"#3B82F6","left":300,"top":250,"originX":"center","originY":"center"},
    {"type":"text","text":"X","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":300,"top":250,"originX":"center","originY":"center"}
  ],"left":300,"top":250,"originX":"center","originY":"center","name":"player"},
  {"type":"group","objects":[
    {"type":"circle","radius":12,"fill":"#3B82F6","stroke":"#3B82F6","left":350,"top":250,"originX":"center","originY":"center"},
    {"type":"text","text":"X","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":350,"top":250,"originX":"center","originY":"center"}
  ],"left":350,"top":250,"originX":"center","originY":"center","name":"player"},
  {"type":"group","objects":[
    {"type":"circle","radius":12,"fill":"#EF4444","stroke":"#EF4444","left":250,"top":350,"originX":"center","originY":"center"},
    {"type":"text","text":"Q","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":250,"top":350,"originX":"center","originY":"center"}
  ],"left":250,"top":350,"originX":"center","originY":"center","name":"player"}
],"width":500,"height":500}'
WHERE name = 'Punt Formation';

-- Add additional offensive formations
DO $$
DECLARE
  system_user_id uuid;
BEGIN
  -- Get system user ID
  SELECT id INTO system_user_id FROM auth.users WHERE email = 'system@playbook.pro';
  
  -- Insert additional formations
  INSERT INTO formations (name, type, template, user_id, is_system) VALUES
    ('Spread', 'offense', '{"objects":[
      {"type":"group","objects":[
        {"type":"circle","radius":12,"fill":"#3B82F6","stroke":"#3B82F6","left":100,"top":250,"originX":"center","originY":"center"},
        {"type":"text","text":"X","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":100,"top":250,"originX":"center","originY":"center"}
      ],"left":100,"top":250,"originX":"center","originY":"center","name":"player"},
      {"type":"group","objects":[
        {"type":"circle","radius":12,"fill":"#10B981","stroke":"#10B981","left":175,"top":250,"originX":"center","originY":"center"},
        {"type":"text","text":"Y","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":175,"top":250,"originX":"center","originY":"center"}
      ],"left":175,"top":250,"originX":"center","originY":"center","name":"player"},
      {"type":"group","objects":[
        {"type":"rect","width":24,"height":24,"fill":"#000000","stroke":"#000000","left":250,"top":300,"originX":"center","originY":"center"},
        {"type":"text","text":"C","fontSize":16,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":250,"top":300,"originX":"center","originY":"center"}
      ],"left":250,"top":300,"originX":"center","originY":"center","name":"player"},
      {"type":"group","objects":[
        {"type":"circle","radius":12,"fill":"#F97316","stroke":"#F97316","left":325,"top":250,"originX":"center","originY":"center"},
        {"type":"text","text":"Z","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":325,"top":250,"originX":"center","originY":"center"}
      ],"left":325,"top":250,"originX":"center","originY":"center","name":"player"},
      {"type":"group","objects":[
        {"type":"circle","radius":12,"fill":"#3B82F6","stroke":"#3B82F6","left":400,"top":250,"originX":"center","originY":"center"},
        {"type":"text","text":"X","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":400,"top":250,"originX":"center","originY":"center"}
      ],"left":400,"top":250,"originX":"center","originY":"center","name":"player"},
      {"type":"group","objects":[
        {"type":"circle","radius":12,"fill":"#EF4444","stroke":"#EF4444","left":250,"top":350,"originX":"center","originY":"center"},
        {"type":"text","text":"Q","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":250,"top":350,"originX":"center","originY":"center"}
      ],"left":250,"top":350,"originX":"center","originY":"center","name":"player"}
    ],"width":500,"height":500}', system_user_id, true),
    
    ('Wing-T', 'offense', '{"objects":[
      {"type":"group","objects":[
        {"type":"circle","radius":12,"fill":"#3B82F6","stroke":"#3B82F6","left":150,"top":250,"originX":"center","originY":"center"},
        {"type":"text","text":"X","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":150,"top":250,"originX":"center","originY":"center"}
      ],"left":150,"top":250,"originX":"center","originY":"center","name":"player"},
      {"type":"group","objects":[
        {"type":"rect","width":24,"height":24,"fill":"#000000","stroke":"#000000","left":250,"top":300,"originX":"center","originY":"center"},
        {"type":"text","text":"C","fontSize":16,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":250,"top":300,"originX":"center","originY":"center"}
      ],"left":250,"top":300,"originX":"center","originY":"center","name":"player"},
      {"type":"group","objects":[
        {"type":"circle","radius":12,"fill":"#10B981","stroke":"#10B981","left":350,"top":250,"originX":"center","originY":"center"},
        {"type":"text","text":"Y","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":350,"top":250,"originX":"center","originY":"center"}
      ],"left":350,"top":250,"originX":"center","originY":"center","name":"player"},
      {"type":"group","objects":[
        {"type":"circle","radius":12,"fill":"#EF4444","stroke":"#EF4444","left":250,"top":350,"originX":"center","originY":"center"},
        {"type":"text","text":"Q","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":250,"top":350,"originX":"center","originY":"center"}
      ],"left":250,"top":350,"originX":"center","originY":"center","name":"player"},
      {"type":"group","objects":[
        {"type":"circle","radius":12,"fill":"#9333EA","stroke":"#9333EA","left":200,"top":350,"originX":"center","originY":"center"},
        {"type":"text","text":"H","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":200,"top":350,"originX":"center","originY":"center"}
      ],"left":200,"top":350,"originX":"center","originY":"center","name":"player"},
      {"type":"group","objects":[
        {"type":"circle","radius":12,"fill":"#EAB308","stroke":"#EAB308","left":300,"top":350,"originX":"center","originY":"center"},
        {"type":"text","text":"R1","fontSize":12,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":300,"top":350,"originX":"center","originY":"center"}
      ],"left":300,"top":350,"originX":"center","originY":"center","name":"player"}
    ],"width":500,"height":500}', system_user_id, true),
    
    ('Single Back', 'offense', '{"objects":[
      {"type":"group","objects":[
        {"type":"circle","radius":12,"fill":"#3B82F6","stroke":"#3B82F6","left":150,"top":250,"originX":"center","originY":"center"},
        {"type":"text","text":"X","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":150,"top":250,"originX":"center","originY":"center"}
      ],"left":150,"top":250,"originX":"center","originY":"center","name":"player"},
      {"type":"group","objects":[
        {"type":"circle","radius":12,"fill":"#10B981","stroke":"#10B981","left":350,"top":250,"originX":"center","originY":"center"},
        {"type":"text","text":"Y","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":350,"top":250,"originX":"center","originY":"center"}
      ],"left":350,"top":250,"originX":"center","originY":"center","name":"player"},
      {"type":"group","objects":[
        {"type":"rect","width":24,"height":24,"fill":"#000000","stroke":"#000000","left":250,"top":300,"originX":"center","originY":"center"},
        {"type":"text","text":"C","fontSize":16,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":250,"top":300,"originX":"center","originY":"center"}
      ],"left":250,"top":300,"originX":"center","originY":"center","name":"player"},
      {"type":"group","objects":[
        {"type":"circle","radius":12,"fill":"#EF4444","stroke":"#EF4444","left":250,"top":350,"originX":"center","originY":"center"},
        {"type":"text","text":"Q","fontSize":14,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":250,"top":350,"originX":"center","originY":"center"}
      ],"left":250,"top":350,"originX":"center","originY":"center","name":"player"},
      {"type":"group","objects":[
        {"type":"circle","radius":12,"fill":"#EAB308","stroke":"#EAB308","left":250,"top":400,"originX":"center","originY":"center"},
        {"type":"text","text":"R1","fontSize":12,"fill":"#FFFFFF","fontFamily":"Inter, sans-serif","fontWeight":"600","left":250,"top":400,"originX":"center","originY":"center"}
      ],"left":250,"top":400,"originX":"center","originY":"center","name":"player"}
    ],"width":500,"height":500}', system_user_id, true);
END $$;