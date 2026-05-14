create table rooms (
 id uuid default gen_random_uuid() primary key,
 room_code text unique,
 current_question integer default 0,
 created_at timestamp default now()
);

create table room_players (
 id uuid default gen_random_uuid() primary key,
 room_code text,
 username text,
 score integer default 0,
 created_at timestamp default now()
);
