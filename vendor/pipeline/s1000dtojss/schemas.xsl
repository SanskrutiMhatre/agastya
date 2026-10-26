<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     S1000D -> JSS: per-schema content mapping

     One entry point per S1000D information type:
       descript  -> content/description
       proced    -> content/procedure
       fault     -> content/faultIsolation | faultReporting
       ipd       -> content/illustratedPartsCatalog
       crew      -> content/crew
     ******************************************************************** -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">

    <!-- Dispatch on whichever content root is present -->
    <xsl:template match="content">
        <xsl:apply-templates select="description | procedure | faultIsolation
                                     | faultReporting | illustratedPartsCatalog | crew"/>
    </xsl:template>

    <!-- ==================================================================== -->
    <!--                            DESCRIPTIVE                                -->
    <!-- ==================================================================== -->
    <!--
      orient="land" on a descendant of description with no levelledPara to
      carry it: description's normal template below is a bare
      apply-templates with no idea what orientation-parts even is, so a
      description whose entire content is one landscape figure - no
      levelledPara wrapper, nothing to trigger the levelledPara-level
      templates further down this file - rendered that figure squeezed onto
      an ordinary portrait page, orient="land" read and silently ignored.
      Structurally the same gap levelledPara already had, in the one place
      levelledPara's own fix could not reach: content that never gets
      wrapped in a levelledPara at all.

      A predicated pattern outranks the bare "description" below it by
      XSLT's own default priority (0.5 against -0.5), so this wins
      regardless of which is read or included first - no explicit priority
      needed, unlike proceduralStep below, which collides with an existing
      predicated pattern at the same default.
    -->
    <xsl:template match="description[descendant::*[@orient=&apos;land&apos;] or descendant::foldout]">
        <xsl:call-template name="orientation-parts">
            <xsl:with-param name="nodes" select="node()"/>
        </xsl:call-template>
    </xsl:template>
    <xsl:template match="description">
        <xsl:apply-templates/>
    </xsl:template>

    <!-- ==================================================================== -->
    <!--                            PROCEDURAL                                 -->
    <!-- ==================================================================== -->
    <xsl:template match="procedure">
        <xsl:apply-templates select="preliminaryRqmts"/>
        <xsl:apply-templates select="mainProcedure"/>
        <xsl:apply-templates select="closeRqmts"/>
    </xsl:template>

    <!--
      Preliminary and closing requirements become the "Management Data" style
      key/value block the stencil uses ahead of a procedure.
    -->
    <xsl:template match="preliminaryRqmts">
        <section>
            <title>Preliminary Requirements</title>
            <xsl:call-template name="requirements-body"/>
        </section>
    </xsl:template>

    <xsl:template match="closeRqmts">
        <section>
            <title>Requirements After Job Completion</title>
            <xsl:call-template name="requirements-body"/>
        </section>
    </xsl:template>

    <!-- The S1000D preliminary/close requirements, rendered as the standard set
         of tables (Required conditions, Required personnel, Support equipment,
         Consumables, Spares, Safety conditions). Each table that the source
         declares is always shown; when its container is empty or carries a
         no-xxx marker the table prints a single "None" row, matching the
         reference layout. -->
    <xsl:template name="requirements-body">
        <!-- Estimated task time, when quoted. -->
        <xsl:if test="productionMaintData/taskDuration/@procedureDuration[. != '' and . != '-']">
            <para indent="none"><b>Estimated task time: </b>
                <xsl:value-of select="productionMaintData/taskDuration/@procedureDuration"/>
                <xsl:text> </xsl:text>
                <xsl:value-of select="productionMaintData/taskDuration/@unitOfMeasure"/>
            </para>
        </xsl:if>

        <!-- Required conditions -->
        <xsl:if test="reqCondGroup">
            <para indent="none"><b>Required conditions</b></para>
            <table widths="1* 70mm">
                <title>Required conditions</title>
                <thead><row><cell>Action/Condition</cell><cell>Data module/Technical publication</cell></row></thead>
                <tbody>
                    <xsl:variable name="conds"
                        select="reqCondGroup/reqCondNoRef | reqCondGroup/reqCondDm | reqCondGroup/reqCondExternalPub"/>
                    <xsl:choose>
                        <xsl:when test="$conds">
                            <xsl:for-each select="$conds">
                                <row>
                                    <cell><xsl:value-of select="normalize-space(reqCond)"/></cell>
                                    <cell>
                                        <xsl:choose>
                                            <xsl:when test=".//dmRef | .//externalPubRef">
                                                <xsl:apply-templates select=".//dmRef | .//externalPubRef"/>
                                            </xsl:when>
                                            <xsl:otherwise><xsl:text>-</xsl:text></xsl:otherwise>
                                        </xsl:choose>
                                    </cell>
                                </row>
                            </xsl:for-each>
                        </xsl:when>
                        <xsl:otherwise><row><cell>None</cell><cell/></row></xsl:otherwise>
                    </xsl:choose>
                </tbody>
            </table>
        </xsl:if>

        <!-- Required personnel -->
        <xsl:if test="reqPersons">
            <para indent="none"><b>Required personnel</b></para>
            <table widths="1* 30mm 32mm">
                <title>Required personnel</title>
                <thead><row><cell>Category</cell><cell>Skill level</cell><cell>Estimated time</cell></row></thead>
                <tbody>
                    <xsl:choose>
                        <xsl:when test="reqPersons//person">
                            <xsl:for-each select="reqPersons//person">
                                <row>
                                    <cell><xsl:value-of select="normalize-space(personCategory/@personCategoryCode)"/></cell>
                                    <cell><xsl:value-of select="normalize-space(personSkill/@skillLevelCode)"/></cell>
                                    <cell>
                                        <xsl:value-of select="normalize-space(estimatedTime)"/>
                                        <xsl:if test="estimatedTime/@unitOfMeasure">
                                            <xsl:text> </xsl:text><xsl:value-of select="estimatedTime/@unitOfMeasure"/>
                                        </xsl:if>
                                    </cell>
                                </row>
                            </xsl:for-each>
                        </xsl:when>
                        <xsl:otherwise><row><cell>None</cell><cell/><cell/></row></xsl:otherwise>
                    </xsl:choose>
                </tbody>
            </table>
        </xsl:if>

        <!-- Support equipment / Consumables / Spares: same four columns.
             .//xxxDescr so the optional xxxDescrGroup wrapper is handled. -->
        <xsl:if test="reqSupportEquips">
            <xsl:call-template name="requirement-table">
                <xsl:with-param name="heading">Support equipment</xsl:with-param>
                <xsl:with-param name="items" select="reqSupportEquips//supportEquipDescr"/>
            </xsl:call-template>
        </xsl:if>
        <xsl:if test="reqSupplies">
            <xsl:call-template name="requirement-table">
                <xsl:with-param name="heading">Consumables, materials and expendables</xsl:with-param>
                <xsl:with-param name="items" select="reqSupplies//supplyDescr"/>
            </xsl:call-template>
        </xsl:if>
        <xsl:if test="reqSpares">
            <xsl:call-template name="requirement-table">
                <xsl:with-param name="heading">Spares</xsl:with-param>
                <xsl:with-param name="items" select="reqSpares//spareDescr"/>
            </xsl:call-template>
        </xsl:if>

        <!-- Safety conditions -->
        <xsl:if test="reqSafety">
            <para indent="none"><b>Safety conditions</b></para>
            <xsl:choose>
                <xsl:when test="reqSafety//warning | reqSafety//caution">
                    <xsl:apply-templates select="reqSafety//warning | reqSafety//caution"/>
                </xsl:when>
                <xsl:otherwise><para indent="none">None</para></xsl:otherwise>
            </xsl:choose>
        </xsl:if>
    </xsl:template>

    <!-- Support equipment / consumables / spares: Name | Identification |
         Quantity | Remark, always shown, "None" when empty. -->
    <xsl:template name="requirement-table">
        <xsl:param name="items"/>
        <xsl:param name="heading"/>
        <para indent="none"><b><xsl:value-of select="$heading"/></b></para>
        <table widths="1* 45mm 22mm 28mm">
            <title><xsl:value-of select="$heading"/></title>
            <thead>
                <row><cell>Name</cell><cell>Identification</cell><cell>Quantity</cell><cell>Remark</cell></row>
            </thead>
            <tbody>
                <xsl:choose>
                    <xsl:when test="$items">
                        <xsl:for-each select="$items">
                            <row>
                                <cell><xsl:apply-templates select="name | descrForPart"/></cell>
                                <cell>
                                    <xsl:variable name="mfr" select="normalize-space(identNumber/manufacturerCode)"/>
                                    <xsl:variable name="pn" select="normalize-space(identNumber//partNumber)"/>
                                    <xsl:choose>
                                        <xsl:when test="$mfr != '' or $pn != ''">
                                            <xsl:value-of select="normalize-space(concat($mfr, ' ', $pn))"/>
                                        </xsl:when>
                                        <xsl:otherwise><xsl:text>-</xsl:text></xsl:otherwise>
                                    </xsl:choose>
                                </cell>
                                <cell>
                                    <xsl:value-of select="normalize-space(reqQuantity)"/>
                                    <xsl:if test="reqQuantity/@unitOfMeasure[. != '' and . != 'EA']">
                                        <xsl:text> </xsl:text><xsl:value-of select="reqQuantity/@unitOfMeasure"/>
                                    </xsl:if>
                                </cell>
                                <cell><xsl:value-of select="normalize-space(remarks)"/></cell>
                            </row>
                        </xsl:for-each>
                    </xsl:when>
                    <xsl:otherwise><row><cell>None</cell><cell/><cell/><cell/></row></xsl:otherwise>
                </xsl:choose>
            </tbody>
        </table>
    </xsl:template>

    <!-- Same gap as description, same fix - see the note there. -->
    <xsl:template match="mainProcedure[descendant::*[@orient=&apos;land&apos;] or descendant::foldout]">
        <xsl:call-template name="orientation-parts">
            <xsl:with-param name="nodes" select="node()"/>
        </xsl:call-template>
    </xsl:template>
    <xsl:template match="mainProcedure">
        <xsl:apply-templates/>
    </xsl:template>

    <!-- A titled step is a numbered section; an untitled one is a list item
         run, which keeps deep procedures readable. -->
    <!--
      Same gap again, one level deeper: a titled step whose body is or
      contains a landscape table used to render portrait regardless. This
      collides with the plain proceduralStep[title] below at the SAME
      default priority - both are "name[predicate]" patterns, and XSLT does
      not rank one predicate as more specific than another the way it ranks
      a predicated pattern over a bare name test - so this needs an
      explicit priority to win deterministically rather than by include
      order.
    -->
    <xsl:template match="proceduralStep[title][descendant::*[@orient=&apos;land&apos;] or descendant::foldout]"
                  priority="1">
        <section>
            <xsl:copy-of select="@id"/>
            <title><xsl:value-of select="normalize-space(title)"/></title>
            <xsl:call-template name="orientation-parts">
                <xsl:with-param name="nodes" select="node()[not(self::title)]"/>
            </xsl:call-template>
        </section>
    </xsl:template>
    <xsl:template match="proceduralStep[title]">
        <section>
            <xsl:copy-of select="@id"/>
            <title><xsl:value-of select="normalize-space(title)"/></title>
            <xsl:apply-templates select="*[not(self::title)]"/>
        </section>
    </xsl:template>

    <xsl:template match="proceduralStep[not(title)]">
        <xsl:choose>
            <!-- Sibling steps at the same level render as a lettered list -->
            <xsl:when test="not(preceding-sibling::proceduralStep)">
                <list>
                    <xsl:for-each select=". | following-sibling::proceduralStep[not(title)]">
                        <item><xsl:apply-templates/></item>
                    </xsl:for-each>
                </list>
            </xsl:when>
            <xsl:otherwise/>
        </xsl:choose>
    </xsl:template>

    <!-- Nested steps inside a list item become a nested list -->
    <xsl:template match="proceduralStep/proceduralStep">
        <xsl:if test="not(preceding-sibling::proceduralStep)">
            <list>
                <xsl:for-each select=". | following-sibling::proceduralStep">
                    <item><xsl:apply-templates/></item>
                </xsl:for-each>
            </list>
        </xsl:if>
    </xsl:template>

    <!-- ==================================================================== -->
    <!--                          FAULT ISOLATION                              -->
    <!-- ==================================================================== -->
    <xsl:template match="faultReporting[descendant::*[@orient=&apos;land&apos;] or descendant::foldout]">
        <section>
            <title>Fault Reporting</title>
            <xsl:call-template name="orientation-parts">
                <xsl:with-param name="nodes" select="node()"/>
            </xsl:call-template>
        </section>
    </xsl:template>
    <xsl:template match="faultReporting">
        <section>
            <title>Fault Reporting</title>
            <xsl:apply-templates/>
        </section>
    </xsl:template>

    <xsl:template match="faultIsolation[descendant::*[@orient=&apos;land&apos;] or descendant::foldout]">
        <xsl:call-template name="orientation-parts">
            <xsl:with-param name="nodes" select="node()"/>
        </xsl:call-template>
    </xsl:template>
    <xsl:template match="faultIsolation">
        <xsl:apply-templates/>
    </xsl:template>

    <xsl:template match="isolationProcedure | faultIsolationProcedure">
        <xsl:apply-templates select="preliminaryRqmts"/>
        <xsl:apply-templates select="isolationMainProcedure"/>
        <xsl:apply-templates select="closeRqmts"/>
    </xsl:template>

    <xsl:template match="isolationMainProcedure">
        <xsl:apply-templates/>
    </xsl:template>

    <xsl:template match="isolationStep">
        <section>
            <title>
                <xsl:choose>
                    <xsl:when test="title"><xsl:value-of select="normalize-space(title)"/></xsl:when>
                    <xsl:otherwise>
                        <xsl:text>Isolation Step </xsl:text>
                        <xsl:number count="isolationStep" level="any"/>
                    </xsl:otherwise>
                </xsl:choose>
            </title>
            <xsl:apply-templates select="*[not(self::title)]"/>
        </section>
    </xsl:template>

    <xsl:template match="isolationStepQuestion">
        <para indent="none"><b>Question: </b><xsl:apply-templates/></para>
    </xsl:template>

    <!-- The question/answer label and its text belong on one line, so the
         child para contributes its content inline rather than opening a
         nested block. -->
    <xsl:template match="isolationStepQuestion/para | yesAnswer/para | noAnswer/para
                         | choice/para | reqCond/para">
        <xsl:apply-templates/>
    </xsl:template>

    <xsl:template match="isolationStepAnswer">
        <xsl:apply-templates/>
    </xsl:template>

    <xsl:template match="yesAnswer">
        <para indent="none"><b>Yes: </b><xsl:apply-templates/></para>
    </xsl:template>

    <xsl:template match="noAnswer">
        <para indent="none"><b>No: </b><xsl:apply-templates/></para>
    </xsl:template>

    <xsl:template match="listOfChoices[choice]">
        <list><xsl:apply-templates select="choice"/></list>
    </xsl:template>

    <xsl:template match="choice">
        <item><xsl:apply-templates/></item>
    </xsl:template>

    <xsl:template match="faultDescr | isolatedFaultDescr | correctiveActionDescr | symptomDescr">
        <para><xsl:apply-templates/></para>
    </xsl:template>

    <!-- ==================================================================== -->
    <!--                  ILLUSTRATED PARTS DATA (IPD)                         -->
    <!-- ==================================================================== -->
    <!--
      The parts catalogue renders as the stencil's parts table: the figure
      first, then one row per catalogue sequence number.
    -->
    <!--
      The parts figure is the one node here, no siblings to partition either
      side of it, so this does not need orientation-parts at all - just the
      same landscape-whole wrapping a self-marked levelledPara gets.
    -->
    <xsl:template match="illustratedPartsCatalog[figure[descendant-or-self::*[@orient=&apos;land&apos;] or descendant-or-self::foldout]]">
        <section split="1" orientation="landscape">
            <xsl:apply-templates select="figure"/>
        </section>
        <xsl:if test="catalogSeqNumber">
            <table widths="18mm 22mm 32mm 1* 18mm 14mm">
                <title>Illustrated Parts List</title>
                <thead>
                    <row>
                        <cell>Fig. Item</cell>
                        <cell>Part Number</cell>
                        <cell>CAGE</cell>
                        <cell>Nomenclature</cell>
                        <cell>Qty</cell>
                        <cell>Unit</cell>
                    </row>
                </thead>
                <tbody>
                    <xsl:apply-templates select="catalogSeqNumber" mode="ipd"/>
                </tbody>
            </table>
        </xsl:if>
    </xsl:template>
    <xsl:template match="illustratedPartsCatalog">
        <xsl:apply-templates select="figure"/>
        <xsl:if test="catalogSeqNumber">
            <table widths="18mm 22mm 32mm 1* 18mm 14mm">
                <title>Illustrated Parts List</title>
                <thead>
                    <row>
                        <cell>Fig. Item</cell>
                        <cell>Part Number</cell>
                        <cell>CAGE</cell>
                        <cell>Nomenclature</cell>
                        <cell>Qty</cell>
                        <cell>Unit</cell>
                    </row>
                </thead>
                <tbody>
                    <xsl:apply-templates select="catalogSeqNumber" mode="ipd"/>
                </tbody>
            </table>
        </xsl:if>
    </xsl:template>

    <xsl:template match="catalogSeqNumber" mode="ipd">
        <xsl:variable name="fig" select="@figureNumber"/>
        <xsl:variable name="item" select="@item"/>
        <xsl:for-each select="itemSeqNumber">
            <row>
                <cell align="center">
                    <xsl:value-of select="$fig"/>
                    <xsl:text>-</xsl:text>
                    <xsl:value-of select="$item"/>
                </cell>
                <cell>
                    <xsl:value-of select="normalize-space(.//partNumber)"/>
                </cell>
                <cell>
                    <xsl:value-of select="normalize-space(.//manufacturerCode)"/>
                </cell>
                <cell>
                    <!-- Indenture is shown by leading dots, as in a parts list -->
                    <xsl:call-template name="indenture-dots">
                        <xsl:with-param name="n" select="number(../@indenture)"/>
                    </xsl:call-template>
                    <xsl:value-of select="normalize-space(.//descrForPart)"/>
                </cell>
                <cell align="center">
                    <xsl:value-of select="normalize-space(.//quantityPerNextHigherAssy)"/>
                </cell>
                <cell align="center">
                    <xsl:value-of select="normalize-space(.//unitOfIssue)"/>
                </cell>
            </row>
        </xsl:for-each>
    </xsl:template>

    <xsl:template name="indenture-dots">
        <xsl:param name="n"/>
        <xsl:if test="$n &gt; 1">
            <xsl:text>. </xsl:text>
            <xsl:call-template name="indenture-dots">
                <xsl:with-param name="n" select="$n - 1"/>
            </xsl:call-template>
        </xsl:if>
    </xsl:template>

    <!-- ==================================================================== -->
    <!--                              CREW                                     -->
    <!-- ==================================================================== -->
    <xsl:template match="crew[descendant::*[@orient=&apos;land&apos;] or descendant::foldout]">
        <xsl:call-template name="orientation-parts">
            <xsl:with-param name="nodes" select="node()"/>
        </xsl:call-template>
    </xsl:template>
    <xsl:template match="crew">
        <xsl:apply-templates/>
    </xsl:template>

    <xsl:template match="crewDrill | subCrewDrill">
        <section>
            <title>
                <xsl:choose>
                    <xsl:when test="title"><xsl:value-of select="normalize-space(title)"/></xsl:when>
                    <xsl:when test="crewProcedureName">
                        <xsl:value-of select="normalize-space(crewProcedureName)"/>
                    </xsl:when>
                    <xsl:otherwise>Crew Drill</xsl:otherwise>
                </xsl:choose>
            </title>
            <xsl:apply-templates select="*[not(self::title or self::crewProcedureName)]"/>
        </section>
    </xsl:template>

    <xsl:template match="crewDrillStep">
        <xsl:if test="not(preceding-sibling::crewDrillStep)">
            <list>
                <xsl:for-each select=". | following-sibling::crewDrillStep">
                    <item><xsl:apply-templates/></item>
                </xsl:for-each>
            </list>
        </xsl:if>
    </xsl:template>

    <!-- Challenge / response pairs render as a two-column table -->
    <xsl:template match="challengeAndResponse | challengeResponse">
        <xsl:if test="not(preceding-sibling::challengeAndResponse | preceding-sibling::challengeResponse)">
            <table widths="1* 1*">
                <thead>
                    <row><cell>Challenge</cell><cell>Response</cell></row>
                </thead>
                <tbody>
                    <xsl:for-each select=". | following-sibling::challengeAndResponse
                                            | following-sibling::challengeResponse">
                        <row>
                            <cell><xsl:apply-templates select="challenge/node()"/></cell>
                            <cell><xsl:apply-templates select="response/node()"/></cell>
                        </row>
                    </xsl:for-each>
                </tbody>
            </table>
        </xsl:if>
    </xsl:template>

    <xsl:template match="operatorInstructions | descrCrew">
        <xsl:apply-templates/>
    </xsl:template>

    <!-- ==================================================================== -->
    <!--          PER-BLOCK LANDSCAPE: partitioning containers                 -->
    <!-- ==================================================================== -->
    <!--
      See "orientation-parts" in content.xsl. A container holding an element
      marked orient="land" hands its children to the partitioner instead of
      rendering them straight through, so only the marked block is rotated.

      A container marked ITSELF (or, for a titled one, through its title) takes
      priority 4 and rotates whole instead — heading included. The "descendant"
      patterns below would also match it, so the self-marked case has to win
      outright.
    -->
    <xsl:template match="description[@orient='land'] | mainProcedure[@orient='land']"
                  priority="4">
        <xsl:apply-templates select="." mode="landscape-whole"/>
    </xsl:template>

    <xsl:template match="proceduralStep[title][@orient='land' or title/@orient='land']"
                  priority="4">
        <xsl:apply-templates select="." mode="landscape-whole"/>
    </xsl:template>

    <xsl:template match="description[descendant::*[@orient='land'] or descendant::foldout]"
                  priority="3">
        <xsl:call-template name="orientation-parts">
            <xsl:with-param name="nodes" select="node()"/>
        </xsl:call-template>
    </xsl:template>

    <xsl:template match="mainProcedure[descendant::*[@orient='land'] or descendant::foldout]"
                  priority="3">
        <xsl:call-template name="orientation-parts">
            <xsl:with-param name="nodes" select="node()"/>
        </xsl:call-template>
    </xsl:template>

    <xsl:template match="proceduralStep[title][descendant::*[@orient='land'] or descendant::foldout]"
                  priority="3">
        <section>
            <xsl:copy-of select="@id"/>
            <title><xsl:value-of select="normalize-space(title)"/></title>
            <xsl:call-template name="orientation-parts">
                <xsl:with-param name="nodes" select="node()[not(self::title)]"/>
            </xsl:call-template>
        </section>
    </xsl:template>

</xsl:stylesheet>
