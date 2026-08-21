function cleanText(value) {
    if (typeof value !== "string") {
        return "";
    }

    return value.trim();
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request) {
    try {
        const contentType = request.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
            return Response.json(
                { message: "The request must contain JSON." },
                { status: 415 }
            );
        }

        const body = await request.json();

        const name = cleanText(body.name);
        const email = cleanText(body.email).toLowerCase();
        const message = cleanText(body.message);

        if (name.length < 2 || name.length > 80) {
            return Response.json(
                { message: "Please enter a valid name." },
                { status: 400 }
            );
        }

        if (!isValidEmail(email) || email.length > 254) {
            return Response.json(
                { message: "Please enter a valid email address." },
                { status: 400 }
            );
        }

        if (message.length < 10 || message.length > 2000) {
            return Response.json(
                { message: "Your message must be between 10 and 2000 characters." },
                { status: 400 }
            );
        }

        if (
            !process.env.RESEND_API_KEY ||
            !process.env.CONTACT_TO_EMAIL ||
            !process.env.CONTACT_FROM_EMAIL
        ) {
            console.error("Contact-form environment variables are missing.");

            return Response.json(
                { message: "The contact form is temporarily unavailable." },
                { status: 500 }
            );
        }

        const emailText = [
            "A new website message has been received.",
            "",
            `Name: ${name}`,
            `Email: ${email}`,
            "",
            "Message:",
            message
        ].join("\n");

        const resendResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                from: process.env.CONTACT_FROM_EMAIL,
                to: [process.env.CONTACT_TO_EMAIL],
                subject: "New message from the A.W Web Designs website",
                text: emailText
            })
        });

        if (!resendResponse.ok) {
            const errorDetails = await resendResponse.text();
            console.error("Resend error:", errorDetails);

            return Response.json(
                { message: "Your message could not be delivered." },
                { status: 502 }
            );
        }

        return Response.json(
            { message: "Your message has been sent successfully." },
            { status: 200 }
        );
    } catch (error) {
        console.error("Contact-form error:", error);

        return Response.json(
            { message: "Something went wrong. Please try again." },
            { status: 500 }
        );
    }
}