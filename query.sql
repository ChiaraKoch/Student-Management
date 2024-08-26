CREATE TABLE students (
    id INT GENERATED ALWAYS AS IDENTITY,
    name VARCHAR(100),
    surname VARCHAR(100),
    age INT,
    confirmation_year INT,
    cell_number VARCHAR(10),
    parish_email VARCHAR(100),
    FOREIGN KEY (parish_email) REFERENCES users(username),
    allergies VARCHAR(100),
    school VARCHAR(100),
    parent_name VARCHAR(100),
    parent_surname VARCHAR(100),
    parent_number VARCHAR(10),
    parent_email VARCHAR(100)
);

CREATE TABLE users (
    id INT GENERATED ALWAYS AS IDENTITY,
    username VARCHAR(100),
    password VARCHAR(60),
    PRIMARY KEY (username)
);

