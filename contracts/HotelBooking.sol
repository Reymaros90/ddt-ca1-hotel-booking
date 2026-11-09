
 // SPDX-License-Identifier: UNLICENSED
 pragma solidity ^0.8.20;

 contract HotelBooking {
    address public immutable hotel;
    address public guest;

    enum BookingStatus { Available, Pending, Confirmed }
    BookingStatus public status;

    event BookingRequested(address indexed guest);
    event BookingConfirmed(address indexed hotel, address indexed guest);

    constructor() {
        hotel = msg.sender;
        status = BookingStatus.Available;
    }

    /** @notice A non-hotel wallet reserves the only available room. */
    function bookRoom() external {
        require(msg.sender != hotel, "Hotel cannot book");
        require(status == BookingStatus.Available, "Room unavailable");

        guest = msg.sender;
        status = BookingStatus.Pending;
        emit BookingRequested(msg.sender);
    }

    /** @notice Only the hotel wallet may confirm a pending booking. */
    function confirmBooking() external {
        require(msg.sender == hotel, "Only hotel can confirm");
        require(status == BookingStatus.Pending, "No pending booking");

        status = BookingStatus.Confirmed;
        emit BookingConfirmed(hotel, guest);
    }

    /** @notice Anyone can read the public booking record. */
    function getBooking() external view returns (address guestAddress, BookingStatus bookingStatus) {
        return (guest, status);
    }
}
