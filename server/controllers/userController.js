const catchAsync = require("../utils/catchAsync");
const {
  getUsersData, getUserById, getUserByEmail,
  insertUser, updateUserById, deleteUserById,
  getRoleByName,
} = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mailService = require("../services/mailService");

exports.getAllUsers = catchAsync(async (req, res) => {
  const allUsers = await getUsersData();
  res.json({ status: 'success', results: allUsers.length, data: allUsers });
});

exports.getUserById = catchAsync(async (req, res) => {
  const user = await getUserById(req.params.id);
  if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
  res.json({ status: 'success', data: user });
});

exports.createUser = catchAsync(async (req, res) => {
  const { name, email, password, role_id } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ status: 'error', message: 'Name, email, and password are required' });

  const existingUser = await getUserByEmail(email);
  if (existingUser)
    return res.status(400).json({ status: 'error', message: 'User with this email already exists' });

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = await insertUser({ name, email, password: hashedPassword, role_id: role_id ?? null });
  res.status(201).json({ status: 'success', data: newUser });
});

exports.updateUser = catchAsync(async (req, res) => {
  const { name, email, password, role_id } = req.body;
  const userId = req.params.id;

  const existingUser = await getUserById(userId);
  if (!existingUser)
    return res.status(404).json({ status: 'error', message: 'User not found' });

  if (email && email !== existingUser.email) {
    const emailExists = await getUserByEmail(email);
    if (emailExists)
      return res.status(400).json({ status: 'error', message: 'Email already in use' });
  }

  const updateFields = {};
  if (name !== undefined) updateFields.name = name;
  if (email !== undefined) updateFields.email = email;
  if (role_id !== undefined) updateFields.role_id = role_id;
  if (password !== undefined) updateFields.password = await bcrypt.hash(password, 10);

  const updatedUser = await updateUserById(userId, updateFields);
  res.json({ status: 'success', data: updatedUser });
});

exports.deleteUser = catchAsync(async (req, res) => {
  const existingUser = await getUserById(req.params.id);
  if (!existingUser)
    return res.status(404).json({ status: 'error', message: 'User not found' });

  await deleteUserById(req.params.id);
  res.json({ status: 'success', message: 'User deleted successfully' });
});

// ── Auth ──────────────────────────────────────────────────────────────────────

exports.register = catchAsync(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ status: 'error', message: 'Name, email, and password are required' });

  const existingUser = await getUserByEmail(email);
  if (existingUser)
    return res.status(400).json({ status: 'error', message: 'User with this email already exists' });

  const userRole = await getRoleByName('user');

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = await insertUser({
    name,
    email,
    password: hashedPassword,
    role_id: userRole?.id ?? null,
  });

  const token = jwt.sign(
    { id: newUser.id, email: newUser.email, role_id: newUser.role_id },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '24h' }
  );

  // Send welcome email — fire and forget so a mail failure doesn't break registration
  mailService.send(newUser.name, newUser.email).catch(err =>
    console.error('[register] Welcome email failed:', err)
  );

  res.status(201).json({
    status: 'success',
    data: {
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: { name: newUser.role?.name } },
      token,
    },
  });
});

exports.login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ status: 'error', message: 'Email and password are required' });

  const user = await getUserByEmail(email);
  if (!user)
    return res.status(401).json({ status: 'error', message: 'Invalid email or password' });

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid)
    return res.status(401).json({ status: 'error', message: 'Invalid email or password' });

  const token = jwt.sign(
    { id: user.id, email: user.email, role_id: user.role_id },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '24h' }
  );

  res.json({
    status: 'success',
    data: {
      user: { id: user.id, name: user.name, email: user.email, role: { name: user.role?.name } },
      token,
    },
  });
});

exports.logout = catchAsync(async (req, res) => {
  res.json({ status: 'success', message: 'Logout successful. Please remove token from client storage.' });
});