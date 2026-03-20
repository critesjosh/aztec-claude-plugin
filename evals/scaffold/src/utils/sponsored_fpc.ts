import { getContractInstanceFromInstantiationParams } from '@aztec/stdlib/contract';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { Fr } from '@aztec/aztec.js/fields';

export async function getSponsoredFPCInstance() {
    return await getContractInstanceFromInstantiationParams(
        SponsoredFPCContractArtifact,
        { salt: new Fr(SPONSORED_FPC_SALT) },
    );
}
