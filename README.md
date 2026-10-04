# 🏥 CareSlot

### Hospital Doctor Availability & Appointment Management System

CareSlot is a role-based hospital appointment management system designed to reduce unnecessary patient waiting and hospital visits by allowing patients to check doctor availability, view appointment slots, book appointments, and receive notifications when a doctor's availability changes.

---

## 🚨 Problem

Patients often travel to hospitals without knowing whether their doctor is:

- Available
- Delayed
- On leave
- Currently accepting appointments

This can result in:

- Unnecessary hospital visits
- Long waiting times
- Missed appointments
- Patient frustration
- Hospital crowding

---

## 💡 Solution

CareSlot provides a centralized platform where patients can:

- Find doctors by department
- View doctor profiles
- Check live doctor availability
- View available appointment slots
- Book appointments
- Cancel or reschedule appointments
- Receive notifications when a doctor's availability changes

The system also provides dedicated portals for doctors and hospital administrators.

---

## 👥 User Roles

CareSlot follows a role-based architecture with three main users.

### 👤 Patient

Patients can:

- Register/login
- Search for doctors
- Filter doctors
- View doctor profiles
- Check doctor availability
- View available appointment slots
- Book appointments
- Cancel appointments
- Reschedule appointments
- View appointment history
- Receive notifications

### 👨‍⚕️ Doctor

Doctors can:

- Login to their doctor portal
- View today's appointments
- Manage weekly schedules
- Set consultation duration
- Update live availability
  - Available
  - Delayed
  - On Leave
- Mark appointments as completed
- Manage their profile

### 👨‍💼 Admin

Administrators can:

- View system overview
- Manage doctors
- Add/edit doctors
- Activate/deactivate doctors
- Manage departments
- View hospital appointments
- Search and filter appointments
- Cancel appointments when required

---

## ⭐ Key Features

### 🔐 Role-Based Authentication

Different users receive different permissions and dashboards.

```text
Patient → Patient Portal
Doctor  → Doctor Portal
Admin   → Admin Portal
