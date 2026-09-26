import Payment from "../models/payment.model.js";
import User from "../models/user.model.js";
import razorpay from "../services/razorpay.service.js";
import crypto from "crypto"

export const createOrder = async (req,res) => {
    try {
        const {planId, amount, credits} = req.body;
          if (!amount || !credits) {
      return res.status(400).json({ message: "Invalid plan data" });
    }

     const options = {
      amount: amount * 100, // convert to paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options)

     await Payment.create({
      userId: req.userId,
      planId,
      amount,
      credits,
      razorpayOrderId: order.id,
      status: "created",
    });

    return res.json(order);

    
    } catch (error) {
         return res.status(500).json({message:`failed to create Razorpay order ${error}`})
    }
}


export const verifyPayment = async (req,res) => {
    try {
        const {razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature} = req.body

      const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

     const payment = await Payment.findOne({
      razorpayOrderId: razorpay_order_id,
    });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    if (payment.status === "paid") {
      return res.json({ message: "Already processed" });
    }

    // Update payment record
    payment.status = "paid";
    payment.razorpayPaymentId = razorpay_payment_id;
    await payment.save();

    // Add credits to user
    const updatedUser = await User.findByIdAndUpdate(payment.userId, {
      $inc: { credits: payment.credits }
    },{new:true});

    res.json({
      success: true,
      message: "Payment verified and credits added",
      user: updatedUser,
    });

    } catch (error) {
         return res.status(500).json({message:`failed to verify Razorpay payment ${error}`})
    }
}



// import Payment from "../models/payment.model.js";

// import User from "../models/user.model.js";

// import razorpay from "../services/razorpay.service.js";

// import crypto from "crypto"


// // =====================================================
// // CREATE RAZORPAY ORDER
// // =====================================================
// //
// // This function runs when frontend calls:
// //
// // POST /api/payment/order
// //
// // Its job is to:
// // 1. Get plan information from frontend
// // 2. Create a Razorpay order
// // 3. Save payment information in MongoDB
// // 4. Send Razorpay order back to frontend
// //
// export const createOrder = async (req, res) => {

//   try {

//     // Get plan information sent by frontend
//     //
//     // Example:
//     // planId = "pro"
//     // amount = 500
//     // credits = 650
//     const { planId, amount, credits } = req.body;


//     // Basic validation
//     //
//     // If amount or credits is missing,
//     // don't create the payment order
//     if (!amount || !credits) {

//       return res.status(400).json({
//         message: "Invalid plan data"
//       });

//     }


//     // Razorpay expects amount in PAISA,
//     // not rupees.
//     //
//     // Example:
//     // ₹500 = 50000 paise
//     const options = {

//       amount: amount * 100,

//       // Currency used for payment
//       currency: "INR",

//       // Generate a unique receipt ID
//       // Date.now() gives the current timestamp
//       receipt: `receipt_${Date.now()}`,

//     };


//     // Create an order on Razorpay
//     //
//     // Razorpay will return an order object
//     // containing an order ID
//     const order = await razorpay.orders.create(options)


//     // Save payment information in MongoDB
//     //
//     // At this point payment has NOT been completed.
//     // So status is "created".
//     await Payment.create({

//       // User who is making the payment
//       // req.userId comes from the isAuth middleware
//       userId: req.userId,

//       // Which plan was selected
//       planId,

//       // Amount of the plan
//       amount,

//       // Credits the user should receive
//       credits,

//       // Razorpay's order ID
//       // This connects our payment record
//       // with the Razorpay order
//       razorpayOrderId: order.id,

//       // Payment has only been created,
//       // not yet paid
//       status: "created",

//     });


//     // Send the Razorpay order back to frontend
//     return res.json(order);


//   } catch (error) {

//     // If something goes wrong,
//     // return a server error
//     return res.status(500).json({
//       message: `failed to create Razorpay order ${error}`
//     })

//   }

// }



// // =====================================================
// // VERIFY RAZORPAY PAYMENT
// // =====================================================
// //
// // This function runs after the user completes payment.
// //
// // Frontend calls:
// //
// // POST /api/payment/verify
// //
// // Its job is to:
// // 1. Receive Razorpay payment details
// // 2. Verify the payment signature
// // 3. Find the payment in MongoDB
// // 4. Mark payment as "paid"
// // 5. Add credits to the user
// // 6. Return updated user
// //
// export const verifyPayment = async (req, res) => {

//   try {


//     // Get payment information sent by Razorpay
//     //
//     // razorpay_order_id:
//     // Identifies the Razorpay order
//     //
//     // razorpay_payment_id:
//     // Identifies the actual payment
//     //
//     // razorpay_signature:
//     // Used to verify that the payment response
//     // is genuine
//     const {
//       razorpay_order_id,
//       razorpay_payment_id,
//       razorpay_signature
//     } = req.body


//     // Create the string required for signature verification
//     //
//     // Format:
//     // order_id|payment_id
//     const body =
//       razorpay_order_id + "|" + razorpay_payment_id;


//     // Generate our own signature using
//     // Razorpay's secret key
//     //
//     // HMAC SHA-256 is used for secure verification
//     const expectedSignature = crypto

//       .createHmac(
//         "sha256",
//         process.env.RAZORPAY_KEY_SECRET
//       )

//       .update(body)

//       .digest("hex");


//     // Compare our generated signature
//     // with the signature sent by Razorpay
//     //
//     // If they don't match,
//     // the payment should not be trusted
//     if (expectedSignature !== razorpay_signature) {

//       return res.status(400).json({
//         message: "Invalid payment signature"
//       });

//     }


//     // Find the payment record in MongoDB
//     // using Razorpay's order ID
//     const payment = await Payment.findOne({

//       razorpayOrderId: razorpay_order_id,

//     });


//     // If payment record doesn't exist,
//     // something is wrong
//     if (!payment) {

//       return res.status(404).json({
//         message: "Payment not found"
//       });

//     }


//     // Prevent processing the same payment twice
//     //
//     // If payment is already marked as paid,
//     // don't add the credits again
//     if (payment.status === "paid") {

//       return res.json({
//         message: "Already processed"
//       });

//     }


//     // ============================================
//     // UPDATE PAYMENT RECORD
//     // ============================================

//     // Mark payment as successfully paid
//     payment.status = "paid";

//     // Store Razorpay's payment ID
//     payment.razorpayPaymentId = razorpay_payment_id;

//     // Save the updated payment document
//     await payment.save();


//     // ============================================
//     // ADD CREDITS TO USER
//     // ============================================

//     // Find the user and increase their credits
//     //
//     // $inc means:
//     // "increase the existing value"
//     //
//     // Example:
//     // Existing credits = 100
//     // Payment credits = 650
//     //
//     // New credits = 750
//     const updatedUser = await User.findByIdAndUpdate(

//       // User whose credits should be updated
//       payment.userId,

//       {
//         $inc: {
//           credits: payment.credits
//         }
//       },

//       // Return the updated user
//       { new: true }

//     );


//     // Send success response to frontend
//     //
//     // The frontend will receive the updated user,
//     // including the newly added credits
//     res.json({

//       success: true,

//       message: "Payment verified and credits added",

//       user: updatedUser,

//     });


//   } catch (error) {

//     // Handle unexpected errors
//     return res.status(500).json({
//       message: `failed to verify Razorpay payment ${error}`
//     })

//   }

// }