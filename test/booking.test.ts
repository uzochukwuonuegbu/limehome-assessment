import axios, { AxiosError } from 'axios';
import { startServer, stopServer } from '../source/server';
import { PrismaClient } from '@prisma/client';

const GUEST_A_UNIT_1 = {
    unitID: '1',
    guestName: 'GuestA',
    checkInDate: new Date().toISOString().split('T')[0],
    numberOfNights: 5,
};

const GUEST_A_UNIT_2 = {
    unitID: '2',
    guestName: 'GuestA',
    checkInDate: new Date().toISOString().split('T')[0],
    numberOfNights: 5,
};

const GUEST_B_UNIT_1 = {
    unitID: '1',
    guestName: 'GuestB',
    checkInDate: new Date().toISOString().split('T')[0],
    numberOfNights: 5,
};

const GUEST_A_UNIT_1_EXTENSION = {
    unitID: '1',
    guestName: 'GuestA',
    checkInDate: new Date(new Date().getTime() + (6 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
    numberOfNights: 3,
};

const GUEST_A_UNIT_2_EXTENSION = {
    unitID: '2',
    guestName: 'GuestA',
    checkInDate: new Date(new Date().getTime() + (6 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
    numberOfNights: 5,
};

const prisma = new PrismaClient();

beforeEach(async () => {
    // Clear any test setup or state before each test
    await prisma.booking.deleteMany();
});

beforeAll(async () => {
    await startServer();
});

afterAll(async () => {
    await prisma.$disconnect();
    await stopServer();
});

describe('Booking API', () => {

    test('Create fresh booking', async () => {
        const response = await axios.post('http://localhost:8000/api/v1/booking', GUEST_A_UNIT_1);

        expect(response.status).toBe(200);
        expect(response.data.guestName).toBe(GUEST_A_UNIT_1.guestName);
        expect(response.data.unitID).toBe(GUEST_A_UNIT_1.unitID);
        expect(response.data.numberOfNights).toBe(GUEST_A_UNIT_1.numberOfNights);
    });

    test('Same guest same unit booking', async () => {
        // Create first booking
        const response1 = await axios.post('http://localhost:8000/api/v1/booking', GUEST_A_UNIT_1);
        expect(response1.status).toBe(200);
        expect(response1.data.guestName).toBe(GUEST_A_UNIT_1.guestName);
        expect(response1.data.unitID).toBe(GUEST_A_UNIT_1.unitID);

        // Guests want to book the same unit again
        let error: any;
        try {
            await axios.post('http://localhost:8000/api/v1/booking', GUEST_A_UNIT_1);
        } catch (e) {
            error = e;
        }

        expect(error).toBeInstanceOf(AxiosError);
        expect(error.response.status).toBe(400);
        expect(error.response.data).toEqual('The given guest name cannot book the same unit multiple times');
    });

    test('Same guest different unit booking', async () => {
        // Create first booking
        const response1 = await axios.post('http://localhost:8000/api/v1/booking', GUEST_A_UNIT_1);
        expect(response1.status).toBe(200);
        expect(response1.data.guestName).toBe(GUEST_A_UNIT_1.guestName);
        expect(response1.data.unitID).toBe(GUEST_A_UNIT_1.unitID);

        // Guest wants to book another unit
        let error: any;
        try {
            await axios.post('http://localhost:8000/api/v1/booking', GUEST_A_UNIT_2);
        } catch (e) {
            error = e;
        }

        expect(error).toBeInstanceOf(AxiosError);
        expect(error.response.status).toBe(400);
        expect(error.response.data).toEqual('The same guest cannot be in multiple units at the same time');
    });

    test('Different guest same unit booking', async () => {
        // Create first booking
        const response1 = await axios.post('http://localhost:8000/api/v1/booking', GUEST_A_UNIT_1);
        expect(response1.status).toBe(200);
        expect(response1.data.guestName).toBe(GUEST_A_UNIT_1.guestName);
        expect(response1.data.unitID).toBe(GUEST_A_UNIT_1.unitID);

        // GuestB trying to book a unit that is already occupied
        let error: any;
        try {
            await axios.post('http://localhost:8000/api/v1/booking', GUEST_B_UNIT_1);
        } catch (e) {
            error = e;
        }

        expect(error).toBeInstanceOf(AxiosError);
        expect(error.response.status).toBe(400);
        expect(error.response.data).toEqual('For the given check-in date, the unit is already occupied');
    });

    test('Different guest same unit booking different date', async () => {
        // Create first booking
        const response1 = await axios.post('http://localhost:8000/api/v1/booking', GUEST_A_UNIT_1);
        expect(response1.status).toBe(200);
        expect(response1.data.guestName).toBe(GUEST_A_UNIT_1.guestName);

        // GuestB trying to book a unit that is already occupied
        let error: any;
        try {
            await axios.post('http://localhost:8000/api/v1/booking', {
                unitID: '1',
                guestName: 'GuestB',
                checkInDate: new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                numberOfNights: 5
            });
        } catch (e) {
            error = e;
        }

        expect(error.response.status).toBe(400);
        expect(error.response.data).toBe('For the given check-in date, the unit is already occupied');
    });

    test('Create booking extension', async () => {
        const bookingResponse = await axios.post('http://localhost:8000/api/v1/booking', GUEST_A_UNIT_1);

        expect(bookingResponse.status).toBe(200);
        expect(bookingResponse.data.guestName).toBe(GUEST_A_UNIT_1.guestName);
        expect(bookingResponse.data.unitID).toBe(GUEST_A_UNIT_1.unitID);
        expect(bookingResponse.data.numberOfNights).toBe(GUEST_A_UNIT_1.numberOfNights);

        const res = await axios.post('http://localhost:8000/api/v1/booking/extend', { ...GUEST_A_UNIT_1_EXTENSION, bookingId: bookingResponse.data.id });

        expect(res.status).toBe(200);
        expect(res.data.previousBookingId).toBe(bookingResponse.data.id);
    });

    test('Extend a booking that does not exist', async () => {
        const nonExistentBookingId = 9999; // Assume a non-existent booking ID
        let error: any;
        try {
            await axios.post('http://localhost:8000/api/v1/booking/extend', {
                ...GUEST_A_UNIT_1_EXTENSION,
                bookingId: nonExistentBookingId,
            });
        } catch (e) {
            error = e;
        }

        expect(error).toBeInstanceOf(AxiosError);
        expect(error.response.status).toBe(400);
        expect(error.response.data).toEqual({ error: 'Booking with ID not found' });
    });

    test('Extend a booking with an already occupied unit', async () => {
        // Create a booking
        const response1 = await axios.post('http://localhost:8000/api/v1/booking', GUEST_A_UNIT_1);
        expect(response1.status).toBe(200);

        // Extend the booking with overlapping dates and the same unit
        let error: any;
        try {
            await axios.post('http://localhost:8000/api/v1/booking/extend', {
                ...GUEST_B_UNIT_1, // Use the same unit as the previous booking
                bookingId: response1.data.id,
            });
        } catch (e) {
            error = e;
        }

        expect(error).toBeInstanceOf(AxiosError);
        expect(error.response.status).toBe(400);
        expect(error.response.data).toEqual({ error: 'For the given check-in date, the unit is already occupied' });
    });

    test('Extend a booking with a different unit', async () => {
        const response1 = await axios.post('http://localhost:8000/api/v1/booking', GUEST_A_UNIT_1);
        expect(response1.status).toBe(200);

        const res = await axios.post('http://localhost:8000/api/v1/booking/extend', {
                ...GUEST_A_UNIT_2, // Use a different unit
                bookingId: response1.data.id,
            });
        expect(res.status).toBe(200);
        expect(res.data.previousBookingId).toBe(response1.data.id);
    });
});
