-- Configurable demonstration catalogs only. No accounts, occurrences or privileges.
insert into public.sectors(id,name,description) values
('a0000000-0000-0000-0000-000000000001','Manutenção elétrica','Iluminação e instalações elétricas.'),
('a0000000-0000-0000-0000-000000000002','Manutenção hidráulica','Vazamentos e instalações hidráulicas.'),
('a0000000-0000-0000-0000-000000000003','Infraestrutura e acessibilidade','Pisos, acessos e estruturas do campus.'),
('a0000000-0000-0000-0000-000000000004','Manutenção de equipamentos','Mobiliário e equipamentos de uso comum.');
insert into public.categories(id,name,icon,sector_id) values
('b0000000-0000-0000-0000-000000000001','Iluminação','bulb','a0000000-0000-0000-0000-000000000001'),
('b0000000-0000-0000-0000-000000000002','Vazamento','drop','a0000000-0000-0000-0000-000000000002'),
('b0000000-0000-0000-0000-000000000003','Acessibilidade','accessibility','a0000000-0000-0000-0000-000000000003'),
('b0000000-0000-0000-0000-000000000004','Equipamentos','tool','a0000000-0000-0000-0000-000000000004');
