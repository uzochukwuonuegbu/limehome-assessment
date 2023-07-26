import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma'

interface Booking {
    guestName: string;
    unitID: string;
    checkInDate: Date;
    numberOfNights: number;
}

interface BookingModel extends Booking {
    id: number;
    firstBookingId?: number | null;
    previousBookingId?: number | null;
    nextBookingId?: number | null;
}

const healthCheck = async (req: Request, res: Response, next: NextFunction) => {
    return res.status(200).json({
        message: "OK"
    })
}

const getBooking = async (req: Request, res: Response, next: NextFunction) => {
    const bookingId = Number(req.params.id);

    const existingBooking = await prisma.booking.findUnique({
        where: {
            id: bookingId,
        }
    });

    return res.status(200).json(existingBooking);
}

const createBooking = async (req: Request, res: Response, next: NextFunction) => {
    const booking: Booking = req.body;

    let outcome = await isBookingPossible(booking);
    if (!outcome.result) {
        return res.status(400).json(outcome.reason);
    }

    let bookingResult = await prisma.booking.create({
        data: {
             guestName: booking.guestName,
             unitID: booking.unitID,
             checkInDate: new Date(booking.checkInDate),
             numberOfNights: booking.numberOfNights
       }
    })

    return res.status(200).json(bookingResult);
}

const extendBooking = async (req: Request, res: Response, next: NextFunction) => {
    // exisiting booking is valid - exists, paid and active e.t.c
    // unit is available for the dates(checkin & numberOfNights) - unit assignment could also be asynchronous, just check if theres a unit available(communicate if the guest needs to change unit)
    // create new booking, update chain of bookings
    try {
        const newBooking = req.body; // Assuming the booking details are sent in the request body

        const existingBooking = await findExistingBooking(newBooking.bookingId) as BookingModel;


        if (!existingBooking) {
            return res.status(400).json({ error: 'Booking with ID not found' });
        }

        const extensionOutcome = await isBookingExtensionPossible(newBooking);
        if (!extensionOutcome.result) {
            return res.status(400).json({ error: extensionOutcome.reason });
        }

        const bookingExtension = await createBookingExtension(newBooking, existingBooking);
        await updatePreviousBooking(existingBooking.id, bookingExtension.id);

        return res.status(200).json(bookingExtension);
    } catch (error) {
        return res.status(500).json({ error: 'Unable to extend booking' });
    }
};

type bookingOutcome = {result:boolean, reason:string};

async function isBookingPossible(booking: Booking): Promise<bookingOutcome> {
    // check 1 : The Same guest cannot book the same unit multiple times
    let sameGuestSameUnit = await prisma.booking.findMany({
        where: {
            AND: {
                guestName: {
                    equals: booking.guestName,
                },
                unitID: {
                    equals: booking.unitID,
                },
            },
        },
    });
    if (sameGuestSameUnit.length > 0) {
        return {result: false, reason: "The given guest name cannot book the same unit multiple times"};
    }

    // check 2 : the same guest cannot be in multiple units at the same time
    let sameGuestAlreadyBooked = await prisma.booking.findMany({
        where: {
            guestName: {
                equals: booking.guestName,
            },
        },
    });
    if (sameGuestAlreadyBooked.length > 0) {
        return {result: false, reason: "The same guest cannot be in multiple units at the same time"};
    }

    // check 3 : Unit is available for the check-in date
    let isUnitAvailableOnCheckInDate = await prisma.booking.findMany({
        where: {
            AND: {
            unitID: booking.unitID,
            OR: [
                {
                    AND: [
                        {
                            checkInDate: {
                                gte: new Date(new Date(booking.checkInDate).getTime() + (booking.numberOfNights * 24 * 60 * 60 * 1000)), // Check if new booking ends after or on the same day as existing booking starts
                            },
                        },
                        {
                            checkInDate: {
                                lte: new Date(booking.checkInDate), // Check if new booking starts on or before existing booking ends
                            },
                        },
                    ],
                },
                {
                    AND: [
                        {
                            checkInDate: {
                                gte: new Date(new Date(booking.checkInDate).getTime() - (booking.numberOfNights * 24 * 60 * 60 * 1000)), // Check if new booking starts after or on the same day as existing booking ends
                            },
                        },
                        {
                            checkInDate: {
                                lte: new Date(booking.checkInDate), // Check if new booking ends on or after existing booking starts
                            },
                        },
                    ],
                },
            ],
        }
    }

    });
    if (isUnitAvailableOnCheckInDate.length > 0) {
        return {result: false, reason: "For the given check-in date, the unit is already occupied"};
    }

    return {result: true, reason: "OK"};
}

async function isBookingExtensionPossible(booking: BookingModel): Promise<bookingOutcome> {
    // unit is available for the dates(checkin & numberOfNights) - unit assignment should  be asynchronous, though I'll just check if theres a unit available(communicate if the guest needs to change unit)
    let isUnitAvailableOnCheckInDate = await prisma.booking.findMany({
        where: {
            AND: {
            unitID: booking.unitID,
            OR: [
                {
                    AND: [
                        {
                            checkInDate: {
                                lte: new Date(new Date(booking.checkInDate).getTime() + (booking.numberOfNights * 24 * 60 * 60 * 1000)),
                            },
                        },
                        {
                            checkInDate: {
                                gte: new Date(booking.checkInDate),
                            },
                        },
                    ],
                },
                {
                    AND: [
                        {
                            checkInDate: {
                                lte: new Date(new Date(booking.checkInDate).getTime() - (booking.numberOfNights * 24 * 60 * 60 * 1000)),
                            },
                        },
                        {
                            checkInDate: {
                                gte: new Date(booking.checkInDate),
                            },
                        },
                    ],
                },
            ],
        }
    }

    });
    if (isUnitAvailableOnCheckInDate.length > 0) {
        return {result: false, reason: "For the given check-in date, the unit is already occupied"};
    }
    return {result: true, reason: "OK"};
}

async function findExistingBooking(bookingId: number): Promise<Booking | null> {
    return await prisma.booking.findUnique({
        where: {
            id: bookingId,
        },
    });
}

async function createBookingExtension(booking: Booking, existingBooking: BookingModel): Promise<BookingModel> {
    return await prisma.booking.create({
        data: {
            unitID: booking.unitID,
            guestName: booking.guestName,
            checkInDate: new Date(booking.checkInDate),
            numberOfNights: booking.numberOfNights,
            firstBookingId: existingBooking?.firstBookingId ?? existingBooking.id,
            previousBookingId: existingBooking.id,
        },
    });
}

async function updatePreviousBooking(existingBookingId: number, newBookingId: number) {
    await prisma.booking.update({
        where: {
            id: existingBookingId,
        },
        data: {
            nextBookingId: newBookingId,
        },
    });
}

export default { healthCheck, createBooking, extendBooking, getBooking }
