import { findAllNoCache } from "../lib/sheets_db";

async function inspect() {
    const orders = await findAllNoCache('Orders');
    const discounted = orders.filter((o: any) => Number(o.discount_amount || 0) > 0);
    console.log(`Total orders with discount_amount > 0: ${discounted.length}`);
    for (let i=0; i<3 && i<discounted.length; i++) {
        console.log(`Order ${discounted[i].id}: discount_amount=${discounted[i].discount_amount}, promo_id=${discounted[i].applied_promotion_id}`);
    }
}
inspect();
