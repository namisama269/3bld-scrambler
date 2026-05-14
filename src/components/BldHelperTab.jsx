import CornerSettingsCard from './bldHelper/CornerSettingsCard.jsx';
import EdgeSettingsCard from './bldHelper/EdgeSettingsCard.jsx';
import GeneralSettingsCard from './bldHelper/GeneralSettingsCard.jsx';

export default function BldHelperTab() {
    return (
        <>
            <CornerSettingsCard />
            <EdgeSettingsCard />
            <GeneralSettingsCard />
        </>
    );
}
