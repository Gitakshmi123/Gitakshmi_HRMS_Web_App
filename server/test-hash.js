const bcrypt = require('bcryptjs');
bcrypt.compare('123456789', '$2b$10$0.y6GETuIr0iMHnbxej05.TOxcYdq0FfL5W0cBoxiH20/szdSprke').then(res => console.log('Matches:', res));
